/**
 * Apply incremental schema migrations for admin-panel backend features.
 * Safe to run on every startup (idempotent).
 */

import db from "../config/db.js";
import {
  columnExists,
  constraintExists,
  getColumnDeclaredType,
  indexExists,
  isSqliteDb,
  tableExists,
} from "./schemaUtils.js";
import { guildConfigExistsFor, seedDefaultConfigForGuild } from "../services/guildConfig.js";

const isSqlite = isSqliteDb();

/**
 * Get or create a trigger_response_functions row by name, returning its id.
 * Used only to backfill trigger_response.response_function during the FK-id migration below.
 * @param {import('mysql2/promise').Pool | { query: Function }} db
 * @param {string} functionName
 * @returns {Promise<number|null>}
 */
async function getOrCreateTriggerResponseFunctionId(db, functionName) {
  const [rows] = await db.query(
    "SELECT id FROM trigger_response_functions WHERE function_name = ?",
    [functionName],
  );
  if (rows && rows.length > 0) return Number(rows[0].id);
  const [result] = await db.query(
    "INSERT INTO trigger_response_functions (function_name) VALUES (?)",
    [functionName],
  );
  const id = result?.insertId ?? result?.lastInsertRowid ?? null;
  return id == null ? null : Number(id);
}

/**
 * Run all pending migrations.
 * @returns {Promise<void>}
 */
export async function ensureSchemaMigrations() {
  console.log("db: checking schema migrations");
  const applied = [];

  // users.role column
  if (await tableExists(db, "users", isSqlite)) {
    if (!(await columnExists(db, "users", "role", isSqlite))) {
      await db.query(
        isSqlite
          ? "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'"
          : "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'admin'",
      );
      applied.push("users.role column");
      console.log("db: migration applied: added users.role column");
    } else {
      console.log("db: schema ok: users.role column already exists");
    }
  }

  // users.guild_id column: scopes a bot (or webview) service account to one guild; NULL means
  // unrestricted (preserves existing single-bot deployments after upgrade).
  if (await tableExists(db, "users", isSqlite)) {
    if (!(await columnExists(db, "users", "guild_id", isSqlite))) {
      await db.query(
        isSqlite
          ? "ALTER TABLE users ADD COLUMN guild_id TEXT NULL"
          : "ALTER TABLE users ADD COLUMN guild_id VARCHAR(64) NULL",
      );
      applied.push("users.guild_id column");
      console.log("db: migration applied: added users.guild_id column");
    } else {
      console.log("db: schema ok: users.guild_id column already exists");
    }
  }

  // member_emoji_tracking table (formerly user_emoji_tracking): rows are keyed on
  // chat_member_mapping, i.e. a server member, not a webapi user account.
  if (await tableExists(db, "member_emoji_tracking", isSqlite)) {
    console.log("db: schema ok: member_emoji_tracking table already exists");
  } else if (await tableExists(db, "user_emoji_tracking", isSqlite)) {
    await db.query("ALTER TABLE user_emoji_tracking RENAME TO member_emoji_tracking");
    applied.push("user_emoji_tracking table renamed to member_emoji_tracking");
    console.log(
      "db: migration applied: renamed user_emoji_tracking table to member_emoji_tracking",
    );
  }

  // member_repost_tracking table (formerly user_repost_tracking): same rationale as above.
  if (await tableExists(db, "member_repost_tracking", isSqlite)) {
    console.log("db: schema ok: member_repost_tracking table already exists");
  } else if (await tableExists(db, "user_repost_tracking", isSqlite)) {
    await db.query("ALTER TABLE user_repost_tracking RENAME TO member_repost_tracking");
    applied.push("user_repost_tracking table renamed to member_repost_tracking");
    console.log(
      "db: migration applied: renamed user_repost_tracking table to member_repost_tracking",
    );
  }

  // audit_log table
  if (!(await tableExists(db, "audit_log", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          resource TEXT NOT NULL,
          resource_id TEXT,
          details TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      await db.query(`
        CREATE TABLE audit_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          action VARCHAR(50) NOT NULL,
          resource VARCHAR(100) NOT NULL,
          resource_id VARCHAR(255) NULL,
          details TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
    }
    applied.push("audit_log table");
    console.log("db: migration applied: created audit_log table");
  } else {
    console.log("db: schema ok: audit_log table already exists");
  }

  // bot_status table (app-scoped; existing installs migrated below)
  if (!(await tableExists(db, "bot_status", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE bot_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          app TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          version TEXT NOT NULL,
          last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (app, guild_id)
        )
      `);
    } else {
      await db.query(`
        CREATE TABLE bot_status (
          id INT AUTO_INCREMENT PRIMARY KEY,
          app VARCHAR(20) NOT NULL,
          guild_id VARCHAR(32) NOT NULL,
          version VARCHAR(50) NOT NULL,
          last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_bot_status_app_guild (app, guild_id)
        )
      `);
    }
    applied.push("bot_status table");
    console.log("db: migration applied: created bot_status table");
  } else {
    console.log("db: schema ok: bot_status table already exists");
  }

  // bot_status: session/health columns from the most recent heartbeat
  if (await tableExists(db, "bot_status", isSqlite)) {
    const botStatusColumns = isSqlite
      ? [
          { name: "ready_at", sql: "ready_at TEXT NULL" },
          { name: "member_count", sql: "member_count INTEGER NULL" },
          { name: "channel_count", sql: "channel_count INTEGER NULL" },
          { name: "ws_ping_ms", sql: "ws_ping_ms INTEGER NULL" },
          { name: "metrics_json", sql: "metrics_json TEXT NULL" },
        ]
      : [
          { name: "ready_at", sql: "ready_at TIMESTAMP NULL" },
          { name: "member_count", sql: "member_count INT NULL" },
          { name: "channel_count", sql: "channel_count INT NULL" },
          { name: "ws_ping_ms", sql: "ws_ping_ms INT NULL" },
          { name: "metrics_json", sql: "metrics_json TEXT NULL" },
        ];

    for (const col of botStatusColumns) {
      if (!(await columnExists(db, "bot_status", col.name, isSqlite))) {
        await db.query(`ALTER TABLE bot_status ADD COLUMN ${col.sql}`);
        applied.push(`bot_status.${col.name} column`);
        console.log(`db: migration applied: added bot_status.${col.name} column`);
      }
    }
  }

  // bot_status: add `app` column + composite (app, guild_id) uniqueness; backfill existing rows to 'discord'
  if ((await tableExists(db, "bot_status", isSqlite)) && !(await columnExists(db, "bot_status", "app", isSqlite))) {
    if (isSqlite) {
      // SQLite can't drop/alter a UNIQUE column constraint in place; rebuild the table.
      await db.query(`
        CREATE TABLE bot_status_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          app TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          version TEXT NOT NULL,
          last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
          ready_at TEXT NULL,
          member_count INTEGER NULL,
          channel_count INTEGER NULL,
          ws_ping_ms INTEGER NULL,
          metrics_json TEXT NULL,
          UNIQUE (app, guild_id)
        )
      `);
      await db.query(`
        INSERT INTO bot_status_new
          (id, app, guild_id, version, last_seen_at, ready_at, member_count, channel_count, ws_ping_ms, metrics_json)
        SELECT id, 'discord', guild_id, version, last_seen_at, ready_at, member_count, channel_count, ws_ping_ms, metrics_json
        FROM bot_status
      `);
      await db.query("DROP TABLE bot_status");
      await db.query("ALTER TABLE bot_status_new RENAME TO bot_status");
    } else {
      await db.query("ALTER TABLE bot_status ADD COLUMN app VARCHAR(20) NULL");
      await db.query("UPDATE bot_status SET app = 'discord' WHERE app IS NULL");
      await db.query("ALTER TABLE bot_status MODIFY COLUMN app VARCHAR(20) NOT NULL");
      await db.query("ALTER TABLE bot_status DROP INDEX guild_id");
      await db.query("ALTER TABLE bot_status ADD UNIQUE KEY uniq_bot_status_app_guild (app, guild_id)");
    }
    applied.push("bot_status.app column + composite unique(app, guild_id)");
    console.log("db: migration applied: added bot_status.app column and (app, guild_id) uniqueness");
  }

  // system_state table
  if (!(await tableExists(db, "system_state", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE system_state (
          state_key TEXT PRIMARY KEY,
          state_value TEXT NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      await db.query(`
        CREATE TABLE system_state (
          state_key VARCHAR(100) PRIMARY KEY,
          state_value VARCHAR(255) NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    }
    applied.push("system_state table");
    console.log("db: migration applied: created system_state table");
  } else {
    console.log("db: schema ok: system_state table already exists");
  }

  // guild_info table (app/guild-scoped chat-platform guild snapshot)
  if (!(await tableExists(db, "guild_info", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE guild_info (
          app TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          icon_url TEXT NULL,
          description TEXT NULL,
          owner_id TEXT NULL,
          boost_tier INTEGER NULL,
          boost_count INTEGER NULL,
          verification_level TEXT NULL,
          preferred_locale TEXT NULL,
          guild_created_at TEXT NULL,
          synced_at TEXT DEFAULT (datetime('now')),
          PRIMARY KEY (app, guild_id)
        )
      `);
    } else {
      await db.query(`
        CREATE TABLE guild_info (
          app VARCHAR(20) NOT NULL,
          guild_id VARCHAR(64) NOT NULL,
          name VARCHAR(100) NOT NULL,
          icon_url VARCHAR(500) NULL,
          description VARCHAR(500) NULL,
          owner_id VARCHAR(64) NULL,
          boost_tier INT NULL,
          boost_count INT NULL,
          verification_level VARCHAR(20) NULL,
          preferred_locale VARCHAR(10) NULL,
          guild_created_at TIMESTAMP NULL,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (app, guild_id)
        )
      `);
    }
    applied.push("guild_info table");
    console.log("db: migration applied: created guild_info table");
  } else {
    console.log("db: schema ok: guild_info table already exists");
  }

  // guild_channels table (app/guild-scoped channel catalog)
  if (!(await tableExists(db, "guild_channels", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE guild_channels (
          app TEXT NOT NULL,
          id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NULL,
          position INTEGER NULL,
          parent_id TEXT NULL,
          synced_at TEXT DEFAULT (datetime('now')),
          PRIMARY KEY (app, id)
        )
      `);
    } else {
      await db.query(`
        CREATE TABLE guild_channels (
          app VARCHAR(20) NOT NULL,
          id VARCHAR(64) NOT NULL,
          guild_id VARCHAR(64) NOT NULL,
          name VARCHAR(100) NOT NULL,
          type VARCHAR(30) NULL,
          position INT NULL,
          parent_id VARCHAR(64) NULL,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (app, id),
          KEY idx_guild_channels_guild (app, guild_id)
        )
      `);
    }
    applied.push("guild_channels table");
    console.log("db: migration applied: created guild_channels table");
  } else {
    console.log("db: schema ok: guild_channels table already exists");
  }

  if (
    isSqlite &&
    (await tableExists(db, "guild_channels", isSqlite)) &&
    !(await indexExists(db, "guild_channels", "idx_guild_channels_guild", isSqlite))
  ) {
    await db.query(
      "CREATE INDEX idx_guild_channels_guild ON guild_channels (app, guild_id)",
    );
    applied.push("guild_channels.idx_guild_channels_guild index");
    console.log("db: migration applied: created guild_channels.idx_guild_channels_guild index");
  }

  // guild_roles table (app/guild-scoped role catalog)
  if (!(await tableExists(db, "guild_roles", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE guild_roles (
          app TEXT NOT NULL,
          id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          color TEXT NULL,
          position INTEGER NULL,
          mentionable INTEGER NULL,
          hoisted INTEGER NULL,
          synced_at TEXT DEFAULT (datetime('now')),
          PRIMARY KEY (app, id)
        )
      `);
    } else {
      await db.query(`
        CREATE TABLE guild_roles (
          app VARCHAR(20) NOT NULL,
          id VARCHAR(64) NOT NULL,
          guild_id VARCHAR(64) NOT NULL,
          name VARCHAR(100) NOT NULL,
          color VARCHAR(7) NULL,
          position INT NULL,
          mentionable TINYINT(1) NULL,
          hoisted TINYINT(1) NULL,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (app, id),
          KEY idx_guild_roles_guild (app, guild_id)
        )
      `);
    }
    applied.push("guild_roles table");
    console.log("db: migration applied: created guild_roles table");
  } else {
    console.log("db: schema ok: guild_roles table already exists");
  }

  if (
    isSqlite &&
    (await tableExists(db, "guild_roles", isSqlite)) &&
    !(await indexExists(db, "guild_roles", "idx_guild_roles_guild", isSqlite))
  ) {
    await db.query(
      "CREATE INDEX idx_guild_roles_guild ON guild_roles (app, guild_id)",
    );
    applied.push("guild_roles.idx_guild_roles_guild index");
    console.log("db: migration applied: created guild_roles.idx_guild_roles_guild index");
  }

  // guild_config table: per-(app, guild_id) config, superseding the global `configurations` table
  if (!(await tableExists(db, "guild_config", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE guild_config (
          app TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          config TEXT NOT NULL,
          value TEXT NULL,
          PRIMARY KEY (app, guild_id, config)
        )
      `);
    } else {
      await db.query(`
        CREATE TABLE guild_config (
          app VARCHAR(20) NOT NULL,
          guild_id VARCHAR(64) NOT NULL,
          config VARCHAR(255) NOT NULL,
          value VARCHAR(255) NULL,
          PRIMARY KEY (app, guild_id, config)
        )
      `);
    }
    applied.push("guild_config table");
    console.log("db: migration applied: created guild_config table");
  } else {
    console.log("db: schema ok: guild_config table already exists");
  }

  // One-time backfill: seed guild_config for every known server from global `configurations`/defaults
  if (await tableExists(db, "guild_config", isSqlite)) {
    const [existingGuilds] = await db.query("SELECT app, guild_id FROM guild_info");
    const [globalConfigRows] = await db.query("SELECT config, value FROM configurations");
    const globalOverrides = Array.isArray(globalConfigRows) ? globalConfigRows : [];
    for (const guild of existingGuilds ?? []) {
      if (await guildConfigExistsFor(guild.app, guild.guild_id)) continue;
      await seedDefaultConfigForGuild(guild.app, guild.guild_id, globalOverrides);
      applied.push(`guild_config backfill for ${guild.app}/${guild.guild_id}`);
      console.log(
        `db: migration applied: seeded guild_config for ${guild.app}/${guild.guild_id}`,
      );
    }
  }

  // guild_members table: per-server membership (Discord handle/nickname/roles/joined-at) keyed
  // off platform_user_id. The link to chat_member_mapping lives in member_aliases (see below),
  // never a column here — sync never creates or touches that link, only a manual admin action does.
  if (!(await tableExists(db, "guild_members", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE guild_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          app TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          platform_user_id TEXT NOT NULL,
          handle TEXT NULL,
          nickname TEXT NULL,
          roles TEXT NULL,
          joined_at TEXT NULL,
          synced_at TEXT DEFAULT (datetime('now')),
          UNIQUE (app, guild_id, platform_user_id)
        )
      `);
      await db.query(
        "CREATE INDEX idx_guild_members_app_guild ON guild_members (app, guild_id)",
      );
    } else {
      await db.query(`
        CREATE TABLE guild_members (
          id INT AUTO_INCREMENT PRIMARY KEY,
          app VARCHAR(20) NOT NULL,
          guild_id VARCHAR(64) NOT NULL,
          platform_user_id VARCHAR(64) NOT NULL,
          handle VARCHAR(255) NULL,
          nickname VARCHAR(255) NULL,
          roles TEXT NULL,
          joined_at DATETIME NULL,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_guild_members_app_guild_platform (app, guild_id, platform_user_id),
          KEY idx_guild_members_app_guild (app, guild_id)
        )
      `);
    }
    applied.push("guild_members table");
    console.log("db: migration applied: created guild_members table");
  } else {
    console.log("db: schema ok: guild_members table already exists");
  }

  // guild_members: platform_user_id + nullable chat_member_mapping_id migration. Old shape had
  // chat_member_mapping_id NOT NULL as part of the PK; new shape keys on platform_user_id instead
  // so a member can be recorded before (or without ever) being resolved to an identity. Only
  // discord/discord_id exists in CHAT_MEMBER_APP_CONFIG today, so hardcoding it for this one-time
  // backfill is fine — every pre-existing row necessarily has a match since the old column was NOT NULL.
  if (
    (await tableExists(db, "guild_members", isSqlite)) &&
    !(await columnExists(db, "guild_members", "platform_user_id", isSqlite))
  ) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE guild_members_new (
          app TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          platform_user_id TEXT NOT NULL,
          chat_member_mapping_id INTEGER NULL REFERENCES chat_member_mapping(id) ON DELETE SET NULL,
          nickname TEXT NULL,
          roles TEXT NULL,
          joined_at TEXT NULL,
          synced_at TEXT DEFAULT (datetime('now')),
          PRIMARY KEY (app, guild_id, platform_user_id)
        )
      `);
      await db.query(`
        INSERT INTO guild_members_new
          (app, guild_id, platform_user_id, chat_member_mapping_id, nickname, roles, joined_at, synced_at)
        SELECT gm.app, gm.guild_id, cmm.discord_id, gm.chat_member_mapping_id,
               gm.nickname, gm.roles, gm.joined_at, gm.synced_at
        FROM guild_members gm
        JOIN chat_member_mapping cmm ON cmm.id = gm.chat_member_mapping_id
      `);
      await db.query("DROP TABLE guild_members");
      await db.query("ALTER TABLE guild_members_new RENAME TO guild_members");
    } else {
      await db.query("ALTER TABLE guild_members ADD COLUMN platform_user_id VARCHAR(64) NULL");
      await db.query(`
        UPDATE guild_members gm
        JOIN chat_member_mapping cmm ON cmm.id = gm.chat_member_mapping_id
        SET gm.platform_user_id = cmm.discord_id
      `);
      await db.query(
        "ALTER TABLE guild_members MODIFY COLUMN platform_user_id VARCHAR(64) NOT NULL",
      );
      if (
        await constraintExists(db, "guild_members", "fk_guild_members_chat_member", isSqlite)
      ) {
        await db.query(
          "ALTER TABLE guild_members DROP FOREIGN KEY fk_guild_members_chat_member",
        );
      }
      await db.query("ALTER TABLE guild_members DROP PRIMARY KEY");
      await db.query(
        "ALTER TABLE guild_members ADD PRIMARY KEY (app, guild_id, platform_user_id)",
      );
      await db.query(
        "ALTER TABLE guild_members MODIFY COLUMN chat_member_mapping_id INT NULL",
      );
      await db.query(
        "ALTER TABLE guild_members ADD CONSTRAINT fk_guild_members_chat_member FOREIGN KEY (chat_member_mapping_id) REFERENCES chat_member_mapping(id) ON DELETE SET NULL",
      );
    }
    applied.push("guild_members: platform_user_id + nullable chat_member_mapping_id migration");
    console.log(
      "db: migration applied: guild_members platform_user_id/nullable-link migration",
    );
  }

  // guild_members.id surrogate PK: needed so member_aliases (below) has a stable row to
  // reference. Without a surrogate id, a full-roster resync (delete+reinsert) would have
  // regenerated every row's identity and cascade-deleted every alias link on each sync.
  if (
    (await tableExists(db, "guild_members", isSqlite)) &&
    !(await columnExists(db, "guild_members", "id", isSqlite))
  ) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE guild_members_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          app TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          platform_user_id TEXT NOT NULL,
          chat_member_mapping_id INTEGER NULL REFERENCES chat_member_mapping(id) ON DELETE SET NULL,
          nickname TEXT NULL,
          roles TEXT NULL,
          joined_at TEXT NULL,
          synced_at TEXT DEFAULT (datetime('now')),
          UNIQUE (app, guild_id, platform_user_id)
        )
      `);
      await db.query(`
        INSERT INTO guild_members_new
          (app, guild_id, platform_user_id, chat_member_mapping_id, nickname, roles, joined_at, synced_at)
        SELECT app, guild_id, platform_user_id, chat_member_mapping_id, nickname, roles, joined_at, synced_at
        FROM guild_members
      `);
      await db.query("DROP TABLE guild_members");
      await db.query("ALTER TABLE guild_members_new RENAME TO guild_members");
      await db.query(
        "CREATE INDEX idx_guild_members_app_guild ON guild_members (app, guild_id)",
      );
    } else {
      await db.query("ALTER TABLE guild_members ADD COLUMN id INT NULL");
      // Backfill sequential ids via a JS loop, not MySQL session variables: `SET @rownum` and
      // the following UPDATE aren't guaranteed to land on the same pooled connection under
      // mysql2/promise's pool, which would silently break the increment.
      const [rowsToNumber] = await db.query(
        "SELECT app, guild_id, platform_user_id FROM guild_members ORDER BY app, guild_id, platform_user_id",
      );
      let nextId = 1;
      for (const row of rowsToNumber ?? []) {
        await db.query(
          "UPDATE guild_members SET id = ? WHERE app = ? AND guild_id = ? AND platform_user_id = ?",
          [nextId, row.app, row.guild_id, row.platform_user_id],
        );
        nextId += 1;
      }
      await db.query(
        "ALTER TABLE guild_members DROP PRIMARY KEY, MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (id)",
      );
      await db.query(
        "ALTER TABLE guild_members ADD UNIQUE KEY uniq_guild_members_app_guild_platform (app, guild_id, platform_user_id)",
      );
    }
    applied.push("guild_members.id surrogate PK");
    console.log("db: migration applied: added guild_members.id surrogate PK");
  }

  // guild_members.handle column (named discord_handle in a brief earlier iteration of this
  // migration; rename it in place for any db that already has it, rather than adding a second
  // column, so a live db that already ran that version doesn't need a fresh backfill).
  if (
    (await tableExists(db, "guild_members", isSqlite)) &&
    !(await columnExists(db, "guild_members", "handle", isSqlite))
  ) {
    if (await columnExists(db, "guild_members", "discord_handle", isSqlite)) {
      await db.query("ALTER TABLE guild_members RENAME COLUMN discord_handle TO handle");
      applied.push("guild_members.discord_handle renamed to handle");
      console.log("db: migration applied: renamed guild_members.discord_handle to handle");
    } else {
      await db.query(
        isSqlite
          ? "ALTER TABLE guild_members ADD COLUMN handle TEXT NULL"
          : "ALTER TABLE guild_members ADD COLUMN handle VARCHAR(255) NULL",
      );
      applied.push("guild_members.handle column");
      console.log("db: migration applied: added guild_members.handle column");
    }
  }

  // Backfill guild_members.handle from chat_member_mapping.discord_handle (the OLD table's own
  // column name — unrelated to the rename above) via the OLD chat_member_mapping_id link, before
  // that column disappears from chat_member_mapping below. Gated on chat_member_mapping still
  // having discord_handle, so this is skippable/idempotent once that column is dropped.
  if (
    (await tableExists(db, "guild_members", isSqlite)) &&
    (await columnExists(db, "guild_members", "chat_member_mapping_id", isSqlite)) &&
    (await columnExists(db, "chat_member_mapping", "discord_handle", isSqlite))
  ) {
    if (isSqlite) {
      await db.query(`
        UPDATE guild_members
        SET handle = (
          SELECT cmm.discord_handle FROM chat_member_mapping cmm WHERE cmm.id = guild_members.chat_member_mapping_id
        )
        WHERE chat_member_mapping_id IS NOT NULL AND handle IS NULL
      `);
    } else {
      await db.query(`
        UPDATE guild_members gm
        JOIN chat_member_mapping cmm ON cmm.id = gm.chat_member_mapping_id
        SET gm.handle = cmm.discord_handle
        WHERE gm.chat_member_mapping_id IS NOT NULL AND gm.handle IS NULL
      `);
    }
    applied.push("guild_members.handle backfill from chat_member_mapping");
    console.log("db: migration applied: backfilled guild_members.handle");
  }

  // member_aliases table: links one chat_member_mapping identity to many guild_members rows.
  // Backfilled from the OLD guild_members.chat_member_mapping_id link (dropped in the next step).
  if (!(await tableExists(db, "member_aliases", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE member_aliases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_member_mapping_id INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
          guild_member_id INTEGER NOT NULL UNIQUE REFERENCES guild_members(id) ON DELETE CASCADE,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      await db.query(
        "CREATE INDEX idx_member_aliases_chat_member ON member_aliases (chat_member_mapping_id)",
      );
    } else {
      await db.query(`
        CREATE TABLE member_aliases (
          id INT AUTO_INCREMENT PRIMARY KEY,
          chat_member_mapping_id INT NOT NULL,
          guild_member_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_member_aliases_guild_member (guild_member_id),
          KEY idx_member_aliases_chat_member (chat_member_mapping_id),
          CONSTRAINT fk_member_aliases_chat_member FOREIGN KEY (chat_member_mapping_id) REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
          CONSTRAINT fk_member_aliases_guild_member FOREIGN KEY (guild_member_id) REFERENCES guild_members(id) ON DELETE CASCADE
        )
      `);
    }
    if (await columnExists(db, "guild_members", "chat_member_mapping_id", isSqlite)) {
      await db.query(`
        INSERT INTO member_aliases (chat_member_mapping_id, guild_member_id)
        SELECT chat_member_mapping_id, id FROM guild_members WHERE chat_member_mapping_id IS NOT NULL
      `);
    }
    applied.push("member_aliases table + backfill from guild_members.chat_member_mapping_id");
    console.log("db: migration applied: created member_aliases table and backfilled it");
  }

  // Drop guild_members.chat_member_mapping_id: superseded by member_aliases.
  if (await columnExists(db, "guild_members", "chat_member_mapping_id", isSqlite)) {
    if (isSqlite) {
      // idx_guild_members_user (if present, from very old installs) must be dropped before the
      // column it indexes, same rule as MySQL's index-then-column-drop ordering below.
      if (await indexExists(db, "guild_members", "idx_guild_members_user", isSqlite)) {
        await db.query("DROP INDEX idx_guild_members_user");
      }
      await db.query("ALTER TABLE guild_members DROP COLUMN chat_member_mapping_id");
    } else {
      if (await constraintExists(db, "guild_members", "fk_guild_members_chat_member", isSqlite)) {
        await db.query("ALTER TABLE guild_members DROP FOREIGN KEY fk_guild_members_chat_member");
      }
      if (await indexExists(db, "guild_members", "idx_guild_members_user", isSqlite)) {
        await db.query("ALTER TABLE guild_members DROP INDEX idx_guild_members_user");
      }
      await db.query("ALTER TABLE guild_members DROP COLUMN chat_member_mapping_id");
    }
    applied.push("guild_members.chat_member_mapping_id column dropped");
    console.log("db: migration applied: dropped guild_members.chat_member_mapping_id");
  }

  // Drop chat_member_mapping.discord_handle/discord_id: moved to guild_members above. Any
  // chat_member_mapping row with zero linked guild_members rows at this point loses its
  // handle/id permanently (no source to backfill from) — rare, accepted, not solved here.
  if (await columnExists(db, "chat_member_mapping", "discord_handle", isSqlite)) {
    if (isSqlite) {
      // Several tables (member_aliases, plusplus_tracking, member_emoji_tracking,
      // member_repost_tracking, trigger_response_user_history, scheduled_messages, pin_history)
      // FK-reference chat_member_mapping(id), some ON DELETE CASCADE. foreign_keys enforcement
      // defaults ON in this SQLite build, so the DROP TABLE below (required to rebuild a table
      // with a UNIQUE column removed) would cascade-delete rows in every one of them the moment
      // the old table is dropped — even though it's immediately recreated with the same ids.
      // Disable enforcement for just this rebuild so those rows survive untouched.
      await db.query("PRAGMA foreign_keys = OFF");
      try {
        await db.query(`
          CREATE TABLE chat_member_mapping_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
          )
        `);
        await db.query("INSERT INTO chat_member_mapping_new (id, name) SELECT id, name FROM chat_member_mapping");
        await db.query("DROP TABLE chat_member_mapping");
        await db.query("ALTER TABLE chat_member_mapping_new RENAME TO chat_member_mapping");
      } finally {
        await db.query("PRAGMA foreign_keys = ON");
      }
    } else {
      await db.query("ALTER TABLE chat_member_mapping DROP COLUMN discord_handle");
      await db.query("ALTER TABLE chat_member_mapping DROP COLUMN discord_id");
    }
    applied.push("chat_member_mapping.discord_handle/discord_id columns dropped");
    console.log("db: migration applied: dropped chat_member_mapping.discord_handle/discord_id");
  }

  // pin_history expanded metadata (author, message snapshot, pinners)
  if (await tableExists(db, "pin_history", isSqlite)) {
    const pinHistoryColumns = isSqlite
      ? [
          {
            name: "author",
            sql: "author INTEGER NULL REFERENCES chat_member_mapping(id) ON DELETE SET NULL",
          },
          { name: "contents", sql: "contents TEXT NULL" },
          { name: "attachments", sql: "attachments TEXT NULL" },
          { name: "channel_id", sql: "channel_id TEXT NULL" },
          { name: "channel_name", sql: "channel_name TEXT NULL" },
          { name: "pinners", sql: "pinners TEXT NULL" },
        ]
      : [
          { name: "author", sql: "author INT NULL" },
          { name: "contents", sql: "contents VARCHAR(5000) NULL" },
          { name: "attachments", sql: "attachments TEXT NULL" },
          { name: "channel_id", sql: "channel_id VARCHAR(32) NULL" },
          { name: "channel_name", sql: "channel_name VARCHAR(100) NULL" },
          { name: "pinners", sql: "pinners TEXT NULL" },
        ];

    for (const col of pinHistoryColumns) {
      if (!(await columnExists(db, "pin_history", col.name, isSqlite))) {
        await db.query(`ALTER TABLE pin_history ADD COLUMN ${col.sql}`);
      }
    }

    if (
      !isSqlite &&
      !(await constraintExists(
        db,
        "pin_history",
        "fk_pin_history_author",
        isSqlite,
      ))
    ) {
      await db.query(
        "ALTER TABLE pin_history ADD CONSTRAINT fk_pin_history_author FOREIGN KEY (author) REFERENCES chat_member_mapping(id) ON DELETE SET NULL",
      );
    }

    // pin_history: surrogate autoincrement id as primary key (msgid stays unique)
    if (isSqlite) {
      if (!(await columnExists(db, "pin_history", "id", isSqlite))) {
        await db.query(`
          CREATE TABLE pin_history_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            msgid TEXT NOT NULL UNIQUE,
            timestamp TEXT DEFAULT (datetime('now')),
            author INTEGER NULL REFERENCES chat_member_mapping(id) ON DELETE SET NULL,
            contents TEXT NULL,
            attachments TEXT NULL,
            channel_id TEXT NULL,
            channel_name TEXT NULL,
            pinners TEXT NULL,
            hydrated INTEGER NOT NULL DEFAULT 0
          )
        `);
        await db.query(`
          INSERT INTO pin_history_new (
            msgid, timestamp, author, contents, attachments, channel_id, channel_name, pinners, hydrated
          )
          SELECT msgid, timestamp, author, contents, attachments, channel_id, channel_name, pinners, 0
          FROM pin_history
        `);
        await db.query("DROP TABLE pin_history");
        await db.query("ALTER TABLE pin_history_new RENAME TO pin_history");
      }
    } else if (!(await columnExists(db, "pin_history", "id", isSqlite))) {
      await db.query(`
        ALTER TABLE pin_history
          DROP PRIMARY KEY,
          ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST,
          ADD UNIQUE KEY unique_pin_history_msgid (msgid)
      `);
    }

    // pin_history.hydrated flag (false for existing rows, true default for new inserts)
    if (!(await columnExists(db, "pin_history", "hydrated", isSqlite))) {
      await db.query(
        isSqlite
          ? "ALTER TABLE pin_history ADD COLUMN hydrated INTEGER NOT NULL DEFAULT 0"
          : "ALTER TABLE pin_history ADD COLUMN hydrated TINYINT(1) NOT NULL DEFAULT 0",
      );
    }
  }

  // Seed pin_message_role_ids if missing
  const [pinRoleRows] = await db.query(
    "SELECT config FROM configurations WHERE config = 'pin_message_role_ids'",
  );
  if (!pinRoleRows || pinRoleRows.length === 0) {
    await db.query("INSERT INTO configurations (config, value) VALUES (?, ?)", [
      "pin_message_role_ids",
      '["612842488302141441"]',
    ]);
    applied.push("pin_message_role_ids configuration seed");
    console.log(
      "db: migration applied: seeded pin_message_role_ids configuration",
    );
  } else {
    console.log(
      "db: schema ok: pin_message_role_ids configuration already exists",
    );
  }

  // Seed user_mapping_import_channel_id if missing (migrated off the
  // discord-bot DISCORD_USER_MAPPING_IMPORT_CHANNEL_ID env var)
  const [userMappingChannelRows] = await db.query(
    "SELECT config FROM configurations WHERE config = 'user_mapping_import_channel_id'",
  );
  if (!userMappingChannelRows || userMappingChannelRows.length === 0) {
    await db.query("INSERT INTO configurations (config, value) VALUES (?, ?)", [
      "user_mapping_import_channel_id",
      "",
    ]);
    applied.push("user_mapping_import_channel_id configuration seed");
    console.log(
      "db: migration applied: seeded user_mapping_import_channel_id configuration",
    );
  } else {
    console.log(
      "db: schema ok: user_mapping_import_channel_id configuration already exists",
    );
  }

  // Seed feature-toggle configuration keys (default enabled) if missing
  const featureToggleKeys = [
    "trigger_responses_enabled",
    "reminders_enabled",
    "eight_ball_enabled",
    "emoji_tracking_enabled",
    "sticker_tracking_enabled",
    "plusplus_enabled",
    "repost_detection_enabled",
    "pin_system_enabled",
  ];
  for (const key of featureToggleKeys) {
    const [rows] = await db.query(
      "SELECT config FROM configurations WHERE config = ?",
      [key],
    );
    if (!rows || rows.length === 0) {
      await db.query(
        "INSERT INTO configurations (config, value) VALUES (?, ?)",
        [key, "true"],
      );
      applied.push(`${key} configuration seed`);
      console.log(`db: migration applied: seeded ${key} configuration`);
    } else {
      console.log(`db: schema ok: ${key} configuration already exists`);
    }
  }

  // Drop deprecated/unused configuration keys
  const deprecatedConfigKeys = [
    "rare_frequency",
    "take_a_look_delay",
    "take_a_look_repost_limit",
    "timeout_emoji",
    "timeout_vote_threshold",
  ];
  for (const key of deprecatedConfigKeys) {
    const [rows] = await db.query(
      "SELECT config FROM configurations WHERE config = ?",
      [key],
    );
    if (rows && rows.length > 0) {
      await db.query("DELETE FROM configurations WHERE config = ?", [key]);
      applied.push(`${key} configuration removed`);
      console.log(`db: migration applied: removed deprecated ${key} configuration`);
    }
  }

  // trigger_response_functions catalog table (formerly trigger_lotto_prizes)
  if (await tableExists(db, "trigger_response_functions", isSqlite)) {
    console.log(
      "db: schema ok: trigger_response_functions table already exists",
    );
  } else if (await tableExists(db, "trigger_lotto_prizes", isSqlite)) {
    await db.query(
      "ALTER TABLE trigger_lotto_prizes RENAME TO trigger_response_functions",
    );
    applied.push(
      "trigger_lotto_prizes table renamed to trigger_response_functions",
    );
    console.log(
      "db: migration applied: renamed trigger_lotto_prizes table to trigger_response_functions",
    );
  } else {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE trigger_response_functions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          function_name TEXT NOT NULL UNIQUE,
          frequency INTEGER DEFAULT 0
        )
      `);
    } else {
      await db.query(`
        CREATE TABLE trigger_response_functions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          function_name VARCHAR(255) NOT NULL UNIQUE,
          frequency INT DEFAULT 0
        )
      `);
    }
    applied.push("trigger_response_functions table");
    console.log(
      "db: migration applied: created trigger_response_functions table",
    );
  }

  // trigger_response_functions.prize_string -> function_name column rename (upgrade path)
  if (
    !(await columnExists(
      db,
      "trigger_response_functions",
      "function_name",
      isSqlite,
    )) &&
    (await columnExists(
      db,
      "trigger_response_functions",
      "prize_string",
      isSqlite,
    ))
  ) {
    await db.query(
      "ALTER TABLE trigger_response_functions RENAME COLUMN prize_string TO function_name",
    );
    applied.push(
      "trigger_response_functions.prize_string renamed to function_name",
    );
    console.log(
      "db: migration applied: renamed trigger_response_functions.prize_string to function_name",
    );
  }

  // trigger_response_functions.display_name column (friendly name for webview display) - must
  // exist before the seed insert below references it.
  if (
    !(await columnExists(
      db,
      "trigger_response_functions",
      "display_name",
      isSqlite,
    ))
  ) {
    await db.query(
      isSqlite
        ? "ALTER TABLE trigger_response_functions ADD COLUMN display_name TEXT NULL"
        : "ALTER TABLE trigger_response_functions ADD COLUMN display_name VARCHAR(255) NULL",
    );
    applied.push("trigger_response_functions.display_name column");
    console.log(
      "db: migration applied: added trigger_response_functions.display_name column",
    );
  }

  const [responseFunctionCountRows] = await db.query(
    "SELECT COUNT(*) AS cnt FROM trigger_response_functions",
  );
  const responseFunctionCount = Number(
    responseFunctionCountRows?.[0]?.cnt ?? 0,
  );
  if (responseFunctionCount === 0) {
    await db.query(
      "INSERT INTO trigger_response_functions (function_name, display_name) VALUES (?, ?)",
      ["TAL_timeout", "Curse of Taking a Look"],
    );
    applied.push("trigger_response_functions seed rows");
    console.log(
      "db: migration applied: seeded trigger_response_functions rows",
    );
  }

  // Backfill known display names for existing catalog rows that don't have one yet.
  const [talTimeoutRows] = await db.query(
    "SELECT id FROM trigger_response_functions WHERE function_name = ? AND display_name IS NULL",
    ["TAL_timeout"],
  );
  if (talTimeoutRows && talTimeoutRows.length > 0) {
    await db.query(
      "UPDATE trigger_response_functions SET display_name = ? WHERE function_name = ?",
      ["Curse of Taking a Look", "TAL_timeout"],
    );
    applied.push("trigger_response_functions.display_name backfill");
    console.log(
      "db: migration applied: backfilled TAL_timeout display_name",
    );
  }

  // Cleanup: the now-retired 'lotto' selection_mode was folded into 'weighted'
  const [lottoModeRows] = await db.query(
    "SELECT COUNT(*) AS cnt FROM triggers WHERE selection_mode = 'lotto'",
  );
  if (Number(lottoModeRows?.[0]?.cnt ?? 0) > 0) {
    await db.query(
      "UPDATE triggers SET selection_mode = 'weighted' WHERE selection_mode = 'lotto'",
    );
    applied.push("triggers.selection_mode lotto -> weighted cleanup");
    console.log(
      "db: migration applied: converted lotto-mode triggers to weighted",
    );
  }

  // trigger_response_user_history table
  if (!(await tableExists(db, "trigger_response_user_history", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE trigger_response_user_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
          trigger_response_id INTEGER NOT NULL REFERENCES trigger_response(id) ON DELETE CASCADE,
          timestamp TEXT DEFAULT (datetime('now'))
        )
      `);
      await db.query(
        "CREATE INDEX IF NOT EXISTS idx_trigger_response_user_history_user ON trigger_response_user_history(user_id)",
      );
      await db.query(
        "CREATE INDEX IF NOT EXISTS idx_trigger_response_user_history_trigger_response ON trigger_response_user_history(trigger_response_id)",
      );
    } else {
      await db.query(`
        CREATE TABLE trigger_response_user_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          trigger_response_id INT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          KEY idx_trigger_response_user_history_user (user_id),
          KEY idx_trigger_response_user_history_trigger_response (trigger_response_id),
          CONSTRAINT fk_trigger_response_user_history_user FOREIGN KEY (user_id) REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
          CONSTRAINT fk_trigger_response_user_history_trigger_response FOREIGN KEY (trigger_response_id) REFERENCES trigger_response(id) ON DELETE CASCADE
        )
      `);
    }
    applied.push("trigger_response_user_history table");
    console.log(
      "db: migration applied: created trigger_response_user_history table",
    );
  } else {
    console.log(
      "db: schema ok: trigger_response_user_history table already exists",
    );
  }

  // trigger_response.response_function column (formerly lotto_prize)
  if (await tableExists(db, "trigger_response", isSqlite)) {
    if (
      await columnExists(db, "trigger_response", "response_function", isSqlite)
    ) {
      console.log(
        "db: schema ok: trigger_response.response_function column already exists",
      );
    } else if (
      await columnExists(db, "trigger_response", "lotto_prize", isSqlite)
    ) {
      await db.query(
        "ALTER TABLE trigger_response RENAME COLUMN lotto_prize TO response_function",
      );
      applied.push("trigger_response.lotto_prize renamed to response_function");
      console.log(
        "db: migration applied: renamed trigger_response.lotto_prize to response_function",
      );
    } else {
      await db.query(
        isSqlite
          ? "ALTER TABLE trigger_response ADD COLUMN response_function TEXT NULL"
          : "ALTER TABLE trigger_response ADD COLUMN response_function VARCHAR(255) NULL",
      );
      applied.push("trigger_response.response_function column");
      console.log(
        "db: migration applied: added trigger_response.response_function column",
      );
    }

    // trigger_response.response_function: convert from a function-name string column to an INT
    // FK referencing trigger_response_functions.id (skipped once it's already an integer type).
    const responseFunctionType = await getColumnDeclaredType(
      db,
      "trigger_response",
      "response_function",
      isSqlite,
    );
    const isIntegerType = [
      "int",
      "integer",
      "bigint",
      "tinyint",
      "smallint",
      "mediumint",
    ].includes(responseFunctionType);

    if (!isIntegerType) {
      const [nameRows] = await db.query(
        "SELECT DISTINCT response_function AS name FROM trigger_response WHERE response_function IS NOT NULL AND response_function <> ''",
      );
      for (const row of nameRows || []) {
        const name = String(row.name).trim();
        if (!name) continue;
        const functionId = await getOrCreateTriggerResponseFunctionId(db, name);
        if (functionId == null) continue;
        await db.query(
          "UPDATE trigger_response SET response_function = ? WHERE response_function = ?",
          [String(functionId), name],
        );
      }
      await db.query(
        "UPDATE trigger_response SET response_function = NULL WHERE response_function = ''",
      );

      if (isSqlite) {
        await db.query(
          "ALTER TABLE trigger_response ADD COLUMN response_function_id INTEGER NULL REFERENCES trigger_response_functions(id) ON DELETE SET NULL",
        );
        await db.query(
          "UPDATE trigger_response SET response_function_id = CAST(response_function AS INTEGER) WHERE response_function IS NOT NULL",
        );
        await db.query(
          "ALTER TABLE trigger_response DROP COLUMN response_function",
        );
        await db.query(
          "ALTER TABLE trigger_response RENAME COLUMN response_function_id TO response_function",
        );
      } else {
        await db.query(
          "ALTER TABLE trigger_response MODIFY COLUMN response_function INT NULL",
        );
      }
      applied.push(
        "trigger_response.response_function converted to FK id referencing trigger_response_functions.id",
      );
      console.log(
        "db: migration applied: converted trigger_response.response_function to FK id",
      );
    }

    if (
      !isSqlite &&
      !(await constraintExists(
        db,
        "trigger_response",
        "fk_trigger_response_response_function",
        isSqlite,
      ))
    ) {
      await db.query(
        "ALTER TABLE trigger_response ADD CONSTRAINT fk_trigger_response_response_function FOREIGN KEY (response_function) REFERENCES trigger_response_functions(id) ON DELETE SET NULL",
      );
      applied.push("trigger_response.response_function FK constraint");
      console.log(
        "db: migration applied: added trigger_response.response_function FK constraint",
      );
    }

    // trigger_response.response_function_parameters: per-link JSON config passed to the
    // dispatched function at execution (e.g. TAL_timeout's roll odds/duration).
    if (
      !(await columnExists(
        db,
        "trigger_response",
        "response_function_parameters",
        isSqlite,
      ))
    ) {
      await db.query(
        "ALTER TABLE trigger_response ADD COLUMN response_function_parameters TEXT NULL",
      );
      applied.push("trigger_response.response_function_parameters column");
      console.log(
        "db: migration applied: added trigger_response.response_function_parameters column",
      );
    }
  }

  if (applied.length === 0) {
    console.log("db: schema valid; no migrations applied");
  } else {
    console.log(
      `db: schema updated; ${applied.length} migration(s) applied: ${applied.join(", ")}`,
    );
  }
}
