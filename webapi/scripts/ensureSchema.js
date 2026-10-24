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

  // emoji_frequency.app column: mirrors guild_channels/guild_roles' app column, for future
  // multi-platform support. No DEFAULT — every insert/update must specify it explicitly going
  // forward (see services/messageProcessing.js). This backfill of 'discord' is a ONE-TIME
  // migration for rows that existed before this column was added, not a general default — only
  // "discord" is supported today, so every pre-existing row is safely known to be a discord row.
  if (
    (await tableExists(db, "emoji_frequency", isSqlite)) &&
    !(await columnExists(db, "emoji_frequency", "app", isSqlite))
  ) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE emoji_frequency_new (
          app TEXT NOT NULL,
          emoid TEXT PRIMARY KEY,
          emoji TEXT NOT NULL,
          frequency INTEGER NOT NULL DEFAULT 0,
          animated INTEGER DEFAULT 0,
          type TEXT DEFAULT NULL
        )
      `);
      await db.query(`
        INSERT INTO emoji_frequency_new (app, emoid, emoji, frequency, animated, type)
        SELECT 'discord', emoid, emoji, frequency, animated, type FROM emoji_frequency
      `);
      await db.query("DROP TABLE emoji_frequency");
      await db.query("ALTER TABLE emoji_frequency_new RENAME TO emoji_frequency");
    } else {
      await db.query("ALTER TABLE emoji_frequency ADD COLUMN app VARCHAR(20) NULL");
      await db.query("UPDATE emoji_frequency SET app = 'discord' WHERE app IS NULL");
      await db.query("ALTER TABLE emoji_frequency MODIFY COLUMN app VARCHAR(20) NOT NULL");
    }
    applied.push("emoji_frequency.app column (backfilled 'discord' for pre-existing rows)");
    console.log(
      "db: migration applied: added emoji_frequency.app column, backfilled 'discord' for pre-existing rows",
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

  // One-time backfill: seed guild_config for every known server from CONFIG_METADATA's defaults
  // (which are themselves CONFIG_DEFAULT_* env-overridable — see configMetadata.js).
  if (await tableExists(db, "guild_config", isSqlite)) {
    const [existingGuilds] = await db.query("SELECT app, guild_id FROM guild_info");
    for (const guild of existingGuilds ?? []) {
      if (await guildConfigExistsFor(guild.app, guild.guild_id)) continue;
      await seedDefaultConfigForGuild(guild.app, guild.guild_id);
      applied.push(`guild_config backfill for ${guild.app}/${guild.guild_id}`);
      console.log(
        `db: migration applied: seeded guild_config for ${guild.app}/${guild.guild_id}`,
      );
    }

    // Every boot: backfill any CONFIG_METADATA keys added after a guild's initial seeding.
    for (const guild of existingGuilds ?? []) {
      const insertedCount = await seedDefaultConfigForGuild(guild.app, guild.guild_id);
      if (insertedCount > 0) {
        applied.push(`guild_config key backfill for ${guild.app}/${guild.guild_id} (${insertedCount} key(s))`);
        console.log(
          `db: migration applied: backfilled ${insertedCount} missing guild_config key(s) for ${guild.app}/${guild.guild_id}`,
        );
      }
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

  // Drop guild_members.pending_link: superseded by pending_account_links (see below), which
  // holds the link-accounts handshake token instead of a single FK column on guild_members.
  if (await columnExists(db, "guild_members", "pending_link", isSqlite)) {
    if (
      !isSqlite &&
      (await constraintExists(db, "guild_members", "fk_guild_members_pending_link", isSqlite))
    ) {
      await db.query("ALTER TABLE guild_members DROP FOREIGN KEY fk_guild_members_pending_link");
    }
    await db.query("ALTER TABLE guild_members DROP COLUMN pending_link");
    applied.push("guild_members.pending_link column dropped");
    console.log("db: migration applied: dropped guild_members.pending_link");
  }

  // pending_account_links table: link-accounts/confirm-link self-service handshake. `app` +
  // `app_user_id` identify the requester; `chat_member_mapping_id` snapshots their existing
  // identity at request time (NULL if they don't have one yet). Deleted on successful confirm.
  if (!(await tableExists(db, "pending_account_links", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE pending_account_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          app TEXT NOT NULL,
          app_user_id TEXT NOT NULL,
          chat_member_mapping_id INTEGER NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
          auth_token TEXT NOT NULL UNIQUE,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      await db.query(
        "CREATE INDEX idx_pending_account_links_app_user ON pending_account_links (app, app_user_id)",
      );
    } else {
      await db.query(`
        CREATE TABLE pending_account_links (
          id INT AUTO_INCREMENT PRIMARY KEY,
          app VARCHAR(20) NOT NULL,
          app_user_id VARCHAR(64) NOT NULL,
          chat_member_mapping_id INT NULL,
          auth_token CHAR(32) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          KEY idx_pending_account_links_app_user (app, app_user_id),
          CONSTRAINT fk_pending_account_links_chat_member FOREIGN KEY (chat_member_mapping_id) REFERENCES chat_member_mapping(id) ON DELETE CASCADE
        )
      `);
    }
    applied.push("pending_account_links table");
    console.log("db: migration applied: created pending_account_links table");
  } else {
    console.log("db: schema ok: pending_account_links table already exists");
  }

  // Backfill guild_members.handle from chat_member_mapping.discord_handle (the OLD table's own
  // column name — unrelated to the rename above), matching directly on
  // chat_member_mapping.discord_id = guild_members.platform_user_id — the authoritative identity
  // match still available in production at this point — rather than the old
  // guild_members.chat_member_mapping_id link, which may be unset for rows synced through a path
  // that never established it. Deliberately re-runs on every boot (WHERE handle IS NULL makes it
  // cheap once caught up): guild_members may still be empty or partially synced on the very boot
  // that first creates it (this migration runs before the bot ever gets a chance to sync — see
  // the member_aliases backfill below for the same reasoning), so this keeps catching newly
  // synced members for as long as chat_member_mapping.discord_handle/discord_id still exist.
  // Those columns are intentionally NOT auto-dropped anywhere in this file (see below) — that is
  // a deliberate separate, manually-triggered step once production data is confirmed backfilled.
  if (
    (await tableExists(db, "guild_members", isSqlite)) &&
    (await columnExists(db, "chat_member_mapping", "discord_handle", isSqlite)) &&
    (await columnExists(db, "chat_member_mapping", "discord_id", isSqlite))
  ) {
    let handleResult;
    if (isSqlite) {
      [handleResult] = await db.query(`
        UPDATE guild_members
        SET handle = (
          SELECT cmm.discord_handle FROM chat_member_mapping cmm WHERE cmm.discord_id = guild_members.platform_user_id
        )
        WHERE handle IS NULL
          AND EXISTS (SELECT 1 FROM chat_member_mapping cmm WHERE cmm.discord_id = guild_members.platform_user_id)
      `);
    } else {
      [handleResult] = await db.query(`
        UPDATE guild_members gm
        JOIN chat_member_mapping cmm ON cmm.discord_id = gm.platform_user_id
        SET gm.handle = cmm.discord_handle
        WHERE gm.handle IS NULL
      `);
    }
    const handleUpdatedCount = handleResult?.affectedRows ?? handleResult?.changes ?? 0;
    if (handleUpdatedCount > 0) {
      applied.push(
        `guild_members.handle backfill via chat_member_mapping.discord_id match (${handleUpdatedCount} row(s))`,
      );
      console.log(
        `db: migration applied: backfilled ${handleUpdatedCount} guild_members.handle row(s) via discord_id match`,
      );
    } else {
      console.log("db: schema ok: guild_members.handle backfill has no new matches to add");
    }
  }

  // member_aliases table: links one chat_member_mapping identity to many guild_members rows.
  // Table creation is one-time; the backfill that populates it is a separate step below that
  // re-runs on every boot, since guild_members may still be empty (or only partially synced) on
  // this very boot — this migration runs before the bot ever gets a chance to sync (webapi's
  // /health, which gates the bot's own container start, isn't reachable until after this whole
  // function returns). A one-shot backfill tied to table creation would permanently miss anyone
  // who joins guild_members on a later boot.
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
    applied.push("member_aliases table");
    console.log("db: migration applied: created member_aliases table");
  }

  // member_aliases backfill: matches chat_member_mapping.discord_id directly against
  // guild_members.platform_user_id — the authoritative identity data production already has —
  // rather than the old guild_members.chat_member_mapping_id link, which may be unset for rows
  // synced through a path that never established it (e.g. the current sync code, which never
  // auto-links at all). A given discord_id is unique on chat_member_mapping, so this matches at
  // most one identity per guild_members row; one identity can still gain many aliases (one per
  // guild). Deliberately re-runs on every boot via the NOT EXISTS guard (cheap once caught up),
  // for as long as chat_member_mapping.discord_id still exists — see the note above on why a
  // one-shot backfill isn't sufficient. Only logged when it actually inserts something, so a
  // fully-caught-up boot doesn't spam "migration applied" forever.
  if (
    (await tableExists(db, "member_aliases", isSqlite)) &&
    (await columnExists(db, "chat_member_mapping", "discord_id", isSqlite))
  ) {
    const [result] = await db.query(`
      INSERT INTO member_aliases (chat_member_mapping_id, guild_member_id)
      SELECT cmm.id, gm.id
      FROM guild_members gm
      JOIN chat_member_mapping cmm ON cmm.discord_id = gm.platform_user_id
      WHERE NOT EXISTS (SELECT 1 FROM member_aliases ma WHERE ma.guild_member_id = gm.id)
    `);
    const insertedCount = result?.affectedRows ?? result?.changes ?? 0;
    if (insertedCount > 0) {
      applied.push(`member_aliases backfill via chat_member_mapping.discord_id match (${insertedCount} row(s))`);
      console.log(
        `db: migration applied: backfilled ${insertedCount} member_aliases row(s) via discord_id match`,
      );
    } else {
      console.log("db: schema ok: member_aliases backfill has no new matches to add");
    }
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

  // chat_member_mapping.handle/app/primary_guild_member_id: snapshot of the alias an admin has
  // designated as this identity's primary account (webadmin "Edit Mapping"). Added after
  // guild_members/member_aliases above since primary_guild_member_id references guild_members.
  if (await tableExists(db, "chat_member_mapping", isSqlite)) {
    if (!(await columnExists(db, "chat_member_mapping", "handle", isSqlite))) {
      await db.query(
        isSqlite
          ? "ALTER TABLE chat_member_mapping ADD COLUMN handle TEXT NULL"
          : "ALTER TABLE chat_member_mapping ADD COLUMN handle VARCHAR(255) NULL",
      );
      applied.push("chat_member_mapping.handle column");
      console.log("db: migration applied: added chat_member_mapping.handle column");
    } else {
      console.log("db: schema ok: chat_member_mapping.handle column already exists");
    }

    if (!(await columnExists(db, "chat_member_mapping", "app", isSqlite))) {
      await db.query(
        isSqlite
          ? "ALTER TABLE chat_member_mapping ADD COLUMN app TEXT NULL"
          : "ALTER TABLE chat_member_mapping ADD COLUMN app VARCHAR(20) NULL",
      );
      applied.push("chat_member_mapping.app column");
      console.log("db: migration applied: added chat_member_mapping.app column");
    } else {
      console.log("db: schema ok: chat_member_mapping.app column already exists");
    }

    if (!(await columnExists(db, "chat_member_mapping", "primary_guild_member_id", isSqlite))) {
      await db.query(
        isSqlite
          ? "ALTER TABLE chat_member_mapping ADD COLUMN primary_guild_member_id INTEGER NULL REFERENCES guild_members(id) ON DELETE SET NULL"
          : "ALTER TABLE chat_member_mapping ADD COLUMN primary_guild_member_id INT NULL",
      );
      applied.push("chat_member_mapping.primary_guild_member_id column");
      console.log("db: migration applied: added chat_member_mapping.primary_guild_member_id column");
    } else {
      console.log("db: schema ok: chat_member_mapping.primary_guild_member_id column already exists");
    }

    if (
      !isSqlite &&
      !(await constraintExists(
        db,
        "chat_member_mapping",
        "fk_chat_member_mapping_primary_guild_member",
        isSqlite,
      ))
    ) {
      await db.query(
        "ALTER TABLE chat_member_mapping ADD CONSTRAINT fk_chat_member_mapping_primary_guild_member FOREIGN KEY (primary_guild_member_id) REFERENCES guild_members(id) ON DELETE SET NULL",
      );
      applied.push("chat_member_mapping.primary_guild_member_id foreign key");
      console.log("db: migration applied: added chat_member_mapping.primary_guild_member_id foreign key");
    }
  }

  // chat_member_mapping.discord_handle/discord_id are DELIBERATELY NOT auto-dropped here.
  // Production has existing chat_member_mapping rows but guild_members is net new — this
  // migration always runs before the bot ever gets a chance to sync (see the member_aliases
  // backfill above), so guild_members may still be empty or only partially populated on the very
  // boot these columns would otherwise be dropped on. Since they're the only remaining source
  // for the member_aliases backfill above, dropping them automatically on some unpredictable
  // boot risks permanently losing the ability to link anyone who hasn't synced into
  // guild_members yet. Once production is confirmed to have backfilled member_aliases as
  // expected (e.g. checking its row count against guild_members), drop these columns via a
  // separate, explicit, manually-triggered migration step — do not re-add this as an automatic
  // step without re-solving the ordering problem described above.
  //
  // That future step, when ready, is exactly what used to run here:
  //   MySQL:  ALTER TABLE chat_member_mapping DROP COLUMN discord_handle;
  //           ALTER TABLE chat_member_mapping DROP COLUMN discord_id;
  //   SQLite: rebuild the table without those columns (both are UNIQUE, so SQLite's
  //           DROP COLUMN can't remove them directly) — wrap in
  //           PRAGMA foreign_keys = OFF / ON, since several tables (member_aliases,
  //           plusplus_tracking, member_emoji_tracking, member_repost_tracking,
  //           trigger_response_user_history, scheduled_messages, pin_history) FK-reference
  //           chat_member_mapping(id), some ON DELETE CASCADE, and foreign_keys enforcement
  //           defaults ON in this SQLite build — see git history for the exact statements.

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

  // milestones table: admin-defined usage-stat thresholds (see services/milestoneTypes.js)
  if (!(await tableExists(db, "milestones", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE milestones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quantity INTEGER NOT NULL,
          type TEXT NOT NULL,
          item TEXT NULL,
          message TEXT NOT NULL,
          object TEXT NOT NULL,
          achieved INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);
      await db.query(
        "CREATE INDEX idx_milestones_lookup ON milestones(type, item, achieved)",
      );
      await db.query(`
        CREATE TRIGGER milestones_updated_at
          AFTER UPDATE ON milestones WHEN OLD.updated_at = NEW.updated_at
          BEGIN
            UPDATE milestones SET updated_at = datetime('now') WHERE id = NEW.id;
          END
      `);
    } else {
      await db.query(`
        CREATE TABLE milestones (
          id INT AUTO_INCREMENT PRIMARY KEY,
          quantity INT NOT NULL,
          type VARCHAR(50) NOT NULL,
          item VARCHAR(255) NULL,
          message VARCHAR(1000) NOT NULL,
          object VARCHAR(50) NOT NULL,
          achieved TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_milestones_lookup (type, item, achieved)
        )
      `);
    }
    applied.push("milestones table");
    console.log("db: migration applied: created milestones table");
  } else {
    console.log("db: schema ok: milestones table already exists");
  }

  // Vote-to-timeout: mutable vote ledger (deleted on reaction-remove) + immutable fired-timeout
  // history (UNIQUE message_id is the idempotency guard against re-triggering).
  if (!(await tableExists(db, "timeout_vote_tracking", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE timeout_vote_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          app TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          target INTEGER REFERENCES chat_member_mapping(id) ON DELETE SET NULL,
          voter INTEGER REFERENCES chat_member_mapping(id) ON DELETE SET NULL,
          weight INTEGER NOT NULL DEFAULT 1,
          timestamp TEXT DEFAULT (datetime('now')),
          UNIQUE (message_id, voter)
        )
      `);
    } else {
      await db.query(`
        CREATE TABLE timeout_vote_tracking (
          id INT AUTO_INCREMENT PRIMARY KEY,
          app VARCHAR(20) NOT NULL,
          guild_id VARCHAR(64) NOT NULL,
          message_id VARCHAR(255) NOT NULL,
          target INT NULL,
          voter INT NULL,
          weight INT NOT NULL DEFAULT 1,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_timeout_vote (message_id, voter),
          CONSTRAINT fk_timeout_vote_target FOREIGN KEY (target) REFERENCES chat_member_mapping(id) ON DELETE SET NULL,
          CONSTRAINT fk_timeout_vote_voter FOREIGN KEY (voter) REFERENCES chat_member_mapping(id) ON DELETE SET NULL
        )
      `);
    }
    applied.push("timeout_vote_tracking table");
    console.log("db: migration applied: created timeout_vote_tracking table");
  } else {
    console.log("db: schema ok: timeout_vote_tracking table already exists");
  }

  if (!(await tableExists(db, "timeout_history", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE timeout_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          app TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          message_id TEXT NOT NULL UNIQUE,
          target INTEGER REFERENCES chat_member_mapping(id) ON DELETE SET NULL,
          vote_weight_total INTEGER NOT NULL,
          duration_seconds INTEGER NOT NULL,
          timestamp TEXT DEFAULT (datetime('now'))
        )
      `);
    } else {
      await db.query(`
        CREATE TABLE timeout_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          app VARCHAR(20) NOT NULL,
          guild_id VARCHAR(64) NOT NULL,
          message_id VARCHAR(255) NOT NULL UNIQUE,
          target INT NULL,
          vote_weight_total INT NOT NULL,
          duration_seconds INT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_timeout_history_target FOREIGN KEY (target) REFERENCES chat_member_mapping(id) ON DELETE SET NULL
        )
      `);
    }
    applied.push("timeout_history table");
    console.log("db: migration applied: created timeout_history table");
  } else {
    console.log("db: schema ok: timeout_history table already exists");
  }

  // guild_emojis: catalog identity split out of emoji_frequency, which narrows to per-guild usage counts.
  if (!(await tableExists(db, "guild_emojis", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE guild_emojis (
          id TEXT PRIMARY KEY,
          app TEXT NULL,
          guild_id TEXT NULL,
          type TEXT NULL,
          name TEXT NOT NULL,
          animated INTEGER DEFAULT 0,
          available INTEGER NULL,
          managed INTEGER NULL,
          requires_colons INTEGER NULL,
          roles TEXT NULL,
          frequency INTEGER NOT NULL DEFAULT 0,
          synced_at TEXT DEFAULT (datetime('now'))
        )
      `);
      await db.query("CREATE INDEX idx_guild_emojis_guild ON guild_emojis (app, guild_id)");
    } else {
      await db.query(`
        CREATE TABLE guild_emojis (
          id VARCHAR(255) PRIMARY KEY,
          app VARCHAR(20) NULL,
          guild_id VARCHAR(64) NULL,
          type VARCHAR(50) NULL,
          name VARCHAR(255) NOT NULL,
          animated TINYINT(1) DEFAULT 0,
          available TINYINT(1) NULL,
          managed TINYINT(1) NULL,
          requires_colons TINYINT(1) NULL,
          roles TEXT NULL,
          frequency INT NOT NULL DEFAULT 0,
          synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          KEY idx_guild_emojis_guild (app, guild_id)
        )
      `);
    }
    applied.push("guild_emojis table");
    console.log("db: migration applied: created guild_emojis table");
  } else {
    console.log("db: schema ok: guild_emojis table already exists");
  }

  // guild_emojis.type: distinguishes emoji/sticker rows for per-kind full-replace sync; backfilled from emoji_frequency.
  if (
    (await tableExists(db, "guild_emojis", isSqlite)) &&
    !(await columnExists(db, "guild_emojis", "type", isSqlite))
  ) {
    await db.query(
      isSqlite
        ? "ALTER TABLE guild_emojis ADD COLUMN type TEXT NULL"
        : "ALTER TABLE guild_emojis ADD COLUMN type VARCHAR(50) NULL",
    );
    if (await tableExists(db, "emoji_frequency", isSqlite)) {
      await db.query(`
        UPDATE guild_emojis
        SET type = (SELECT ef.type FROM emoji_frequency ef WHERE ef.emoid = guild_emojis.id LIMIT 1)
        WHERE type IS NULL AND EXISTS (SELECT 1 FROM emoji_frequency ef WHERE ef.emoid = guild_emojis.id)
      `);
    }
    applied.push("guild_emojis.type column (backfilled from emoji_frequency)");
    console.log("db: migration applied: added guild_emojis.type column, backfilled from emoji_frequency");
  } else {
    console.log("db: schema ok: guild_emojis.type column already exists");
  }

  // guild_emojis.frequency: usage count synced from emoji_frequency (by emoid) via
  // discord-bot/scripts/sync-emoji-frequency.js. Starts at 0; not auto-backfilled here.
  if (
    (await tableExists(db, "guild_emojis", isSqlite)) &&
    !(await columnExists(db, "guild_emojis", "frequency", isSqlite))
  ) {
    await db.query(
      isSqlite
        ? "ALTER TABLE guild_emojis ADD COLUMN frequency INTEGER NOT NULL DEFAULT 0"
        : "ALTER TABLE guild_emojis ADD COLUMN frequency INT NOT NULL DEFAULT 0",
    );
    applied.push("guild_emojis.frequency column");
    console.log("db: migration applied: added guild_emojis.frequency column");
  } else {
    console.log("db: schema ok: guild_emojis.frequency column already exists");
  }

  // Backfill guild_emojis from legacy emoji_frequency rows, then narrow emoji_frequency once every row
  // is accounted for. Legacy rows lack guild_id, so they're only attributable when exactly one guild is known.
  if (
    (await tableExists(db, "guild_emojis", isSqlite)) &&
    (await tableExists(db, "emoji_frequency", isSqlite)) &&
    (await columnExists(db, "emoji_frequency", "emoji", isSqlite))
  ) {
    const [guildRows] = await db.query("SELECT app, guild_id FROM guild_info");
    const knownGuilds = Array.isArray(guildRows) ? guildRows : [];

    const [legacyRows] = await db.query(
      "SELECT app, emoid, emoji, animated, type FROM emoji_frequency",
    );
    const isNumericEmoid = (emoid) => /^\d+$/.test(String(emoid));

    let insertedCount = 0;
    let ambiguousCount = 0;
    for (const row of legacyRows ?? []) {
      const [existing] = await db.query("SELECT id FROM guild_emojis WHERE id = ?", [row.emoid]);
      if (existing && existing.length > 0) continue;

      if (isNumericEmoid(row.emoid)) {
        if (knownGuilds.length !== 1) {
          ambiguousCount += 1;
          continue;
        }
        await db.query(
          "INSERT INTO guild_emojis (id, app, guild_id, type, name, animated) VALUES (?, ?, ?, ?, ?, ?)",
          [row.emoid, knownGuilds[0].app, knownGuilds[0].guild_id, row.type, row.emoji, row.animated ? 1 : 0],
        );
      } else {
        await db.query(
          "INSERT INTO guild_emojis (id, app, guild_id, type, name, animated) VALUES (?, NULL, NULL, ?, ?, ?)",
          [row.emoid, row.type, row.emoji, row.animated ? 1 : 0],
        );
      }
      insertedCount += 1;
    }

    if (insertedCount > 0) {
      applied.push(`guild_emojis backfill (${insertedCount} row(s))`);
      console.log(
        `db: migration applied: backfilled ${insertedCount} guild_emojis row(s) from emoji_frequency`,
      );
    }
    if (ambiguousCount > 0) {
      console.log(
        `db: schema warning: ${ambiguousCount} legacy custom-emoji emoji_frequency row(s) could not be attributed to a single known guild (guild_info has ${knownGuilds.length} guild(s)); left unmigrated`,
      );
    }

    const [remainingRows] = await db.query(
      "SELECT COUNT(*) AS total FROM emoji_frequency ef WHERE NOT EXISTS (SELECT 1 FROM guild_emojis ge WHERE ge.id = ef.emoid)",
    );
    const remaining = Number(remainingRows?.[0]?.total ?? 0);

    if (remaining > 0) {
      console.log(
        `db: schema ok: emoji_frequency narrowing deferred — ${remaining} row(s) not yet represented in guild_emojis`,
      );
    } else if (knownGuilds.length !== 1) {
      console.log(
        `db: schema warning: emoji_frequency narrowing skipped — guild_info has ${knownGuilds.length} guild(s), can't safely assign legacy rows a guild_id`,
      );
    } else {
      if (isSqlite) {
        // emoid deliberately isn't a real FK to guild_emojis — it'd cascade-delete usage history on catalog sync.
        await db.query(`
          CREATE TABLE emoji_frequency_new (
            app TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            emoid TEXT NOT NULL,
            frequency INTEGER NOT NULL DEFAULT 0,
            type TEXT DEFAULT NULL,
            PRIMARY KEY (app, guild_id, emoid)
          )
        `);
        await db.query(
          `INSERT INTO emoji_frequency_new (app, guild_id, emoid, frequency, type)
           SELECT app, ?, emoid, frequency, type FROM emoji_frequency`,
          [knownGuilds[0].guild_id],
        );
        await db.query("DROP TABLE emoji_frequency");
        await db.query("ALTER TABLE emoji_frequency_new RENAME TO emoji_frequency");
      } else {
        await db.query("ALTER TABLE emoji_frequency ADD COLUMN guild_id VARCHAR(64) NULL");
        await db.query("UPDATE emoji_frequency SET guild_id = ? WHERE guild_id IS NULL", [
          knownGuilds[0].guild_id,
        ]);
        await db.query(
          "ALTER TABLE emoji_frequency DROP PRIMARY KEY, MODIFY COLUMN guild_id VARCHAR(64) NOT NULL, ADD PRIMARY KEY (app, guild_id, emoid), DROP COLUMN emoji, DROP COLUMN animated",
        );
      }
      applied.push("emoji_frequency narrowed to (app, guild_id, emoid); emoji/animated moved to guild_emojis");
      console.log(
        "db: migration applied: narrowed emoji_frequency to (app, guild_id, emoid), dropped emoji/animated columns",
      );
    }
  } else {
    console.log("db: schema ok: emoji_frequency already narrowed (no emoji/animated columns)");
  }

  // Repair: strip a mistakenly-added emoid FK (SQLite only) that would cascade-delete usage history.
  // Detected via stored CREATE TABLE text, since PRAGMA foreign_key_list doesn't round-trip through db.js.
  const emojiFrequencyDdl = isSqlite
    ? (
        await db.query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'emoji_frequency'")
      )[0]?.[0]?.sql
    : null;
  if (isSqlite && emojiFrequencyDdl && /REFERENCES\s+guild_emojis/i.test(emojiFrequencyDdl)) {
    await db.query(`
      CREATE TABLE emoji_frequency_new (
        app TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        emoid TEXT NOT NULL,
        frequency INTEGER NOT NULL DEFAULT 0,
        type TEXT DEFAULT NULL,
        PRIMARY KEY (app, guild_id, emoid)
      )
    `);
    await db.query(`
      INSERT INTO emoji_frequency_new (app, guild_id, emoid, frequency, type)
      SELECT app, guild_id, emoid, frequency, type FROM emoji_frequency
    `);
    await db.query("DROP TABLE emoji_frequency");
    await db.query("ALTER TABLE emoji_frequency_new RENAME TO emoji_frequency");
    applied.push("emoji_frequency.emoid FK to guild_emojis removed (was unsafe ON DELETE CASCADE)");
    console.log(
      "db: migration applied: removed emoji_frequency.emoid's FK to guild_emojis (was unsafe ON DELETE CASCADE)",
    );
  }

  // MySQL only. Two separate unicode-emoji bugs, both fixed here:
  //
  // 1. A table/database left on utf8/utf8mb3 (or latin1) silently mangles 4-byte unicode emoji
  //    into an identical fallback character on insert. Convert every table to utf8mb4.
  //
  // 2. Even on utf8mb4, MySQL's default collations (utf8mb4_general_ci / utf8mb4_unicode_ci) are
  //    linguistic (case/accent-insensitive) and don't assign distinct comparison weights to most
  //    emoji (supplementary-plane characters) — so `WHERE id = ?` in ensureAndIncrementEmoji
  //    (services/messageProcessing.js) treats many different emoji as equal, always matching
  //    whatever unicode emoji was inserted first and incrementing *its* row instead of inserting
  //    a new one. No error, no truncated bytes — just silent permanent misattribution onto the
  //    first-ever emoji. Fix: force utf8mb4_bin (exact byte comparison) on the identity columns
  //    used for exact lookups (guild_emojis.id, member_emoji_tracking.emoid,
  //    emoji_frequency.emoid) — display columns like guild_emojis.name are unaffected and stay ci.
  //
  // Either fix invalidates existing unicode-emoji rows (app/guild_id IS NULL, per schema.sql) —
  // their frequency/name may already be an unrecoverable merge of multiple distinct emoji — so
  // both purge those rows (and matching member_emoji_tracking/emoji_frequency rows) once applied.
  // SQLite stores TEXT as UTF-8 with byte-exact comparison natively, so this whole block is a
  // no-op there.
  if (!isSqlite) {
    let identityFixApplied = false;

    try {
      const [dbCollationRows] = await db.query(
        "SELECT DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()",
      );
      const dbCollation = String(dbCollationRows?.[0]?.DEFAULT_COLLATION_NAME ?? "");
      if (!dbCollation.startsWith("utf8mb4")) {
        await db.query("ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
      }
    } catch (err) {
      console.error(
        "db: could not set database default charset to utf8mb4 (likely missing ALTER privilege on the schema) — continuing with per-table conversion:",
        err.message,
      );
    }

    const [tableRows] = await db.query(
      `SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`,
    );
    const nonUtf8mb4Tables = (tableRows ?? [])
      .filter((r) => !String(r.TABLE_COLLATION ?? "").startsWith("utf8mb4"))
      .map((r) => r.TABLE_NAME);

    if (nonUtf8mb4Tables.length > 0) {
      for (const table of nonUtf8mb4Tables) {
        await db.query(
          `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        );
      }
      identityFixApplied = identityFixApplied || nonUtf8mb4Tables.includes("guild_emojis");
      applied.push(
        `converted ${nonUtf8mb4Tables.length} table(s) to utf8mb4 (${nonUtf8mb4Tables.join(", ")})`,
      );
      console.log(`db: migration applied: converted to utf8mb4: ${nonUtf8mb4Tables.join(", ")}`);
    }

    const emoidColumns = [
      { table: "guild_emojis", column: "id", ddl: "id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL" },
      { table: "member_emoji_tracking", column: "emoid", ddl: "emoid VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL" },
      { table: "emoji_frequency", column: "emoid", ddl: "emoid VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL" },
    ];
    const fixedColumns = [];
    for (const { table, column, ddl } of emoidColumns) {
      if (!(await tableExists(db, table, isSqlite))) continue;
      const [colRows] = await db.query(
        `SELECT COLLATION_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column],
      );
      const collation = String(colRows?.[0]?.COLLATION_NAME ?? "");
      if (collation === "utf8mb4_bin") continue;
      await db.query(`ALTER TABLE \`${table}\` MODIFY COLUMN ${ddl}`);
      fixedColumns.push(`${table}.${column}`);
      if (table === "guild_emojis") identityFixApplied = true;
    }
    if (fixedColumns.length > 0) {
      applied.push(`switched to utf8mb4_bin for exact-match emoji identity columns (${fixedColumns.join(", ")})`);
      console.log(
        `db: migration applied: switched to utf8mb4_bin (exact comparison) on ${fixedColumns.join(", ")} — a linguistic _ci collation was treating distinct unicode emoji as equal`,
      );
    }

    if (identityFixApplied) {
      const [staleUnicodeRows] = await db.query(
        "SELECT id FROM guild_emojis WHERE app IS NULL AND guild_id IS NULL",
      );
      const staleIds = (staleUnicodeRows ?? []).map((r) => String(r.id));
      if (staleIds.length > 0) {
        const placeholders = staleIds.map(() => "?").join(",");
        await db.query(
          `DELETE FROM member_emoji_tracking WHERE emoid IN (${placeholders})`,
          staleIds,
        );
        await db.query(`DELETE FROM emoji_frequency WHERE emoid IN (${placeholders})`, staleIds);
        await db.query(`DELETE FROM guild_emojis WHERE id IN (${placeholders})`, staleIds);
        applied.push(
          `reset ${staleIds.length} pre-fix unicode guild_emojis row(s) (usage may have been merged under one collapsed id)`,
        );
        console.log(
          `db: migration applied: reset ${staleIds.length} unicode guild_emojis row(s), and matching member_emoji_tracking/emoji_frequency rows, that predate the utf8mb4/utf8mb4_bin fix`,
        );
      }
    }
  }

  // Drop emoji_frequency: pure legacy — every read/write path moved to guild_emojis.frequency
  // long ago (ensureAndIncrementEmoji in messageProcessing.js), and the one-time admin backfill
  // script that used to copy leftover counts out of it (discord-bot/scripts/sync-emoji-frequency.js)
  // is gone too. So this does that backfill itself, once, automatically: any frequency still
  // sitting here is added onto guild_emojis.frequency (summed across however many (app, guild_id)
  // rows share an emoid — SELECT only needs emoid/frequency, so this works regardless of which
  // historical shape the table is still in), inserting a bare guild_emojis row (name falls back
  // to the id) for any emoid with no catalog row at all. Then the table itself is dropped.
  if (await tableExists(db, "emoji_frequency", isSqlite)) {
    const [legacyRows] = await db.query("SELECT emoid, frequency FROM emoji_frequency");
    const legacyTotals = new Map();
    for (const row of legacyRows ?? []) {
      const emoid = String(row.emoid ?? "").trim();
      const frequency = Number(row.frequency) || 0;
      if (!emoid || frequency === 0) continue;
      legacyTotals.set(emoid, (legacyTotals.get(emoid) ?? 0) + frequency);
    }

    let merged = 0;
    let inserted = 0;
    for (const [emoid, legacyFrequency] of legacyTotals) {
      const [existing] = await db.query("SELECT id FROM guild_emojis WHERE id = ?", [emoid]);
      if (existing && existing.length > 0) {
        await db.query("UPDATE guild_emojis SET frequency = frequency + ? WHERE id = ?", [
          legacyFrequency,
          emoid,
        ]);
        merged += 1;
      } else {
        await db.query("INSERT INTO guild_emojis (id, name, frequency) VALUES (?, ?, ?)", [
          emoid,
          emoid,
          legacyFrequency,
        ]);
        inserted += 1;
      }
    }

    await db.query("DROP TABLE emoji_frequency");
    applied.push(
      `emoji_frequency table dropped (merged into ${merged}, inserted ${inserted} guild_emojis row(s) first)`,
    );
    console.log(
      `db: migration applied: dropped legacy emoji_frequency table (merged into ${merged}, inserted ${inserted} guild_emojis row(s) from its leftover counts first)`,
    );
  } else {
    console.log("db: schema ok: emoji_frequency table already dropped");
  }

  // Drop sticker_frequency: pure legacy, never read or written by any code — sticker usage
  // counting lives in guild_emojis (type = 'sticker'), same as emoji counting. No data to
  // preserve first (nothing ever wrote to it).
  if (await tableExists(db, "sticker_frequency", isSqlite)) {
    await db.query("DROP TABLE sticker_frequency");
    applied.push("sticker_frequency table dropped (unused legacy table)");
    console.log("db: migration applied: dropped unused legacy sticker_frequency table");
  } else {
    console.log("db: schema ok: sticker_frequency table already dropped");
  }

  // Drop configurations: the single-global predecessor to guild_config (per-(app, guild_id)
  // config), which is what every feature actually reads/writes today. Its only remaining
  // consumer was the guild_config backfill above, which already ran (using whatever was in this
  // table) earlier in this same migration pass — so by this point there's nothing left to
  // preserve. New defaults for that backfill, and for brand-new guilds, now come from
  // CONFIG_METADATA (optionally overridden via CONFIG_DEFAULT_* env vars — see configMetadata.js)
  // instead of this table.
  if (await tableExists(db, "configurations", isSqlite)) {
    await db.query("DROP TABLE configurations");
    applied.push("configurations table dropped (superseded by guild_config)");
    console.log("db: migration applied: dropped legacy configurations table (superseded by guild_config)");
  } else {
    console.log("db: schema ok: configurations table already dropped");
  }

  // scheduled_messages: generalize discord_channel_id/discord_guild_id (resolved via a per-app
  // column-name map) to a plain app/channel_id/guild_id shape, matching every other app-scoped
  // table. Pre-existing rows predate multi-app support, so backfilling app='discord' is safe.
  if (
    (await tableExists(db, "scheduled_messages", isSqlite)) &&
    !(await columnExists(db, "scheduled_messages", "channel_id", isSqlite))
  ) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE scheduled_messages_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          app TEXT NOT NULL,
          user_id INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
          channel_id TEXT NOT NULL,
          guild_id TEXT,
          message_body TEXT NOT NULL,
          scheduled_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
          sent_at TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      await db.query(`
        INSERT INTO scheduled_messages_new
          (id, app, user_id, channel_id, guild_id, message_body, scheduled_at, status, sent_at, created_at)
        SELECT id, 'discord', user_id, discord_channel_id, discord_guild_id, message_body, scheduled_at, status, sent_at, created_at
        FROM scheduled_messages
      `);
      await db.query("DROP TABLE scheduled_messages");
      await db.query("ALTER TABLE scheduled_messages_new RENAME TO scheduled_messages");
      await db.query(
        "CREATE INDEX idx_scheduled_messages_due ON scheduled_messages (status, scheduled_at)",
      );
      await db.query(
        "CREATE INDEX idx_scheduled_messages_app_user ON scheduled_messages (app, user_id, status)",
      );
    } else {
      await db.query("ALTER TABLE scheduled_messages ADD COLUMN app VARCHAR(20) NULL");
      await db.query("UPDATE scheduled_messages SET app = 'discord' WHERE app IS NULL");
      await db.query(
        "ALTER TABLE scheduled_messages MODIFY COLUMN app VARCHAR(20) NOT NULL",
      );
      await db.query(
        "ALTER TABLE scheduled_messages CHANGE discord_channel_id channel_id VARCHAR(32) NOT NULL",
      );
      await db.query(
        "ALTER TABLE scheduled_messages CHANGE discord_guild_id guild_id VARCHAR(32) NULL",
      );
      await db.query(
        "ALTER TABLE scheduled_messages ADD KEY idx_scheduled_messages_app_user (app, user_id, status)",
      );
    }
    applied.push(
      "scheduled_messages: generalized discord_channel_id/discord_guild_id to app/channel_id/guild_id",
    );
    console.log(
      "db: migration applied: scheduled_messages generalized to app/channel_id/guild_id (backfilled app='discord')",
    );
  } else {
    console.log("db: schema ok: scheduled_messages already generalized");
  }

  // pin_history.guild_id: lets each app's bot hydration loop (and admin filtering) scope to its
  // own pins instead of a mixed-app stream, now that more than one platform can create pins.
  if (
    (await tableExists(db, "pin_history", isSqlite)) &&
    !(await columnExists(db, "pin_history", "guild_id", isSqlite))
  ) {
    await db.query(
      isSqlite
        ? "ALTER TABLE pin_history ADD COLUMN guild_id TEXT NULL"
        : "ALTER TABLE pin_history ADD COLUMN guild_id VARCHAR(64) NULL",
    );

    // Backfill: every pre-existing row predates multi-app support, so they all belong to
    // whatever the single Discord guild was at the time. Only safe to infer when exactly one
    // guild_info row exists for app='discord' — otherwise leave guild_id NULL (unknown/legacy).
    let backfilled = false;
    if (await tableExists(db, "guild_info", isSqlite)) {
      const [discordGuildRows] = await db.query(
        "SELECT guild_id FROM guild_info WHERE app = 'discord'",
      );
      if (Array.isArray(discordGuildRows) && discordGuildRows.length === 1) {
        const knownGuildId = discordGuildRows[0].guild_id;
        await db.query(
          "UPDATE pin_history SET guild_id = ? WHERE guild_id IS NULL",
          [knownGuildId],
        );
        backfilled = true;
        applied.push("pin_history.guild_id column (backfilled from guild_info)");
        console.log(
          `db: migration applied: added pin_history.guild_id column, backfilled from guild_info (${knownGuildId})`,
        );
      }
    }
    if (!backfilled) {
      applied.push("pin_history.guild_id column (left NULL — ambiguous/no guild_info match)");
      console.log(
        "db: migration applied: added pin_history.guild_id column; could not uniquely determine the pre-existing Discord guild from guild_info — left NULL (legacy/unknown)",
      );
    }
  } else {
    console.log("db: schema ok: pin_history.guild_id column already exists");
  }

  // pin_history: add `app` column + composite (app, msgid) uniqueness, replacing the msgid-only
  // unique key — message ids are only guaranteed unique within their own platform, so two apps'
  // ids could otherwise collide (see services/messageProcessing.js isMessageAlreadyPinned).
  // Backfill existing rows to 'discord' (every pre-existing row predates multi-app support).
  if (
    (await tableExists(db, "pin_history", isSqlite)) &&
    !(await columnExists(db, "pin_history", "app", isSqlite))
  ) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE pin_history_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          app TEXT NOT NULL,
          msgid TEXT NOT NULL,
          timestamp TEXT DEFAULT (datetime('now')),
          author INTEGER NULL REFERENCES chat_member_mapping(id) ON DELETE SET NULL,
          contents TEXT NULL,
          attachments TEXT NULL,
          channel_id TEXT NULL,
          channel_name TEXT NULL,
          pinners TEXT NULL,
          hydrated INTEGER NOT NULL DEFAULT 1,
          guild_id TEXT NULL,
          UNIQUE (app, msgid)
        )
      `);
      await db.query(`
        INSERT INTO pin_history_new (
          id, app, msgid, timestamp, author, contents, attachments, channel_id, channel_name,
          pinners, hydrated, guild_id
        )
        SELECT id, 'discord', msgid, timestamp, author, contents, attachments, channel_id,
          channel_name, pinners, hydrated, guild_id
        FROM pin_history
      `);
      await db.query("DROP TABLE pin_history");
      await db.query("ALTER TABLE pin_history_new RENAME TO pin_history");
    } else {
      await db.query("ALTER TABLE pin_history ADD COLUMN app VARCHAR(20) NULL");
      await db.query("UPDATE pin_history SET app = 'discord' WHERE app IS NULL");
      await db.query("ALTER TABLE pin_history MODIFY COLUMN app VARCHAR(20) NOT NULL");
      // The msgid-only unique index is named "msgid" on a fresh install (inline UNIQUE) or
      // "unique_pin_history_msgid" on an install upgraded via the older surrogate-id migration
      // above — drop whichever is actually present before adding the composite replacement.
      if (await indexExists(db, "pin_history", "msgid", isSqlite)) {
        await db.query("ALTER TABLE pin_history DROP INDEX msgid");
      } else if (await indexExists(db, "pin_history", "unique_pin_history_msgid", isSqlite)) {
        await db.query("ALTER TABLE pin_history DROP INDEX unique_pin_history_msgid");
      }
      await db.query(
        "ALTER TABLE pin_history ADD UNIQUE KEY unique_pin_history_app_msgid (app, msgid)",
      );
    }
    applied.push("pin_history.app column + composite unique(app, msgid)");
    console.log(
      "db: migration applied: added pin_history.app column, backfilled 'discord' for pre-existing rows, and replaced the msgid-only unique key with (app, msgid)",
    );
  } else {
    console.log("db: schema ok: pin_history.app column already exists");
  }

  // member_repost_tracking: add `app` column + composite (app, userid, msgid, accuser)
  // uniqueness, replacing the (userid, msgid, accuser) unique key — msgid is only guaranteed
  // unique within its own platform. Global/per-user repost totals never filter on app (see
  // services/leaderboards.js, services/milestones.js), so this only prevents cross-platform
  // msgid collisions, not a per-app split in the stats.
  if (
    (await tableExists(db, "member_repost_tracking", isSqlite)) &&
    !(await columnExists(db, "member_repost_tracking", "app", isSqlite))
  ) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE member_repost_tracking_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          app TEXT NOT NULL,
          userid INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
          msgid TEXT NOT NULL,
          accuser INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
          timestamp TEXT DEFAULT (datetime('now')),
          msgcontents TEXT,
          UNIQUE (app, userid, msgid, accuser)
        )
      `);
      await db.query(`
        INSERT INTO member_repost_tracking_new (
          id, app, userid, msgid, accuser, timestamp, msgcontents
        )
        SELECT id, 'discord', userid, msgid, accuser, timestamp, msgcontents
        FROM member_repost_tracking
      `);
      await db.query("DROP TABLE member_repost_tracking");
      await db.query("ALTER TABLE member_repost_tracking_new RENAME TO member_repost_tracking");
    } else {
      await db.query("ALTER TABLE member_repost_tracking ADD COLUMN app VARCHAR(20) NULL");
      await db.query("UPDATE member_repost_tracking SET app = 'discord' WHERE app IS NULL");
      await db.query(
        "ALTER TABLE member_repost_tracking MODIFY COLUMN app VARCHAR(20) NOT NULL",
      );
      if (await indexExists(db, "member_repost_tracking", "unique_repost_accusation", isSqlite)) {
        await db.query(
          "ALTER TABLE member_repost_tracking DROP INDEX unique_repost_accusation",
        );
      }
      await db.query(
        "ALTER TABLE member_repost_tracking ADD UNIQUE KEY unique_repost_accusation (app, userid, msgid, accuser)",
      );
    }
    applied.push(
      "member_repost_tracking.app column + composite unique(app, userid, msgid, accuser)",
    );
    console.log(
      "db: migration applied: added member_repost_tracking.app column, backfilled 'discord' for pre-existing rows, and replaced the (userid, msgid, accuser) unique key with (app, userid, msgid, accuser)",
    );
  } else {
    console.log("db: schema ok: member_repost_tracking.app column already exists");
  }

  // plusplus_tracking.app column: which platform cast the vote. Global/per-word/per-user totals
  // (services/leaderboards.js, services/milestones.js) never filter on it — a word's or user's
  // score stays one cross-platform number, not fragmented per app.
  if (
    (await tableExists(db, "plusplus_tracking", isSqlite)) &&
    !(await columnExists(db, "plusplus_tracking", "app", isSqlite))
  ) {
    if (isSqlite) {
      await db.query("ALTER TABLE plusplus_tracking ADD COLUMN app TEXT");
      await db.query("UPDATE plusplus_tracking SET app = 'discord' WHERE app IS NULL");
    } else {
      await db.query("ALTER TABLE plusplus_tracking ADD COLUMN app VARCHAR(20) NULL");
      await db.query("UPDATE plusplus_tracking SET app = 'discord' WHERE app IS NULL");
      await db.query("ALTER TABLE plusplus_tracking MODIFY COLUMN app VARCHAR(20) NOT NULL");
    }
    applied.push("plusplus_tracking.app column (backfilled 'discord' for pre-existing rows)");
    console.log(
      "db: migration applied: added plusplus_tracking.app column, backfilled 'discord' for pre-existing rows",
    );
  } else {
    console.log("db: schema ok: plusplus_tracking.app column already exists");
  }

  if (applied.length === 0) {
    console.log("db: schema valid; no migrations applied");
  } else {
    console.log(
      `db: schema updated; ${applied.length} migration(s) applied: ${applied.join(", ")}`,
    );
  }
}
