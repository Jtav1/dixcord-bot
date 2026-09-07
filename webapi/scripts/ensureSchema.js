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

  // bot_status table
  if (!(await tableExists(db, "bot_status", isSqlite))) {
    if (isSqlite) {
      await db.query(`
        CREATE TABLE bot_status (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL UNIQUE,
          version TEXT NOT NULL,
          last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      await db.query(`
        CREATE TABLE bot_status (
          id INT AUTO_INCREMENT PRIMARY KEY,
          guild_id VARCHAR(32) NOT NULL UNIQUE,
          version VARCHAR(50) NOT NULL,
          last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    }
    applied.push("bot_status table");
    console.log("db: migration applied: created bot_status table");
  } else {
    console.log("db: schema ok: bot_status table already exists");
  }

  // bot_status: session/health columns (ready_at, member_count, channel_count, ws_ping_ms)
  if (await tableExists(db, "bot_status", isSqlite)) {
    const botStatusColumns = isSqlite
      ? [
          { name: "ready_at", sql: "ready_at TEXT NULL" },
          { name: "member_count", sql: "member_count INTEGER NULL" },
          { name: "channel_count", sql: "channel_count INTEGER NULL" },
          { name: "ws_ping_ms", sql: "ws_ping_ms INTEGER NULL" },
        ]
      : [
          { name: "ready_at", sql: "ready_at TIMESTAMP NULL" },
          { name: "member_count", sql: "member_count INT NULL" },
          { name: "channel_count", sql: "channel_count INT NULL" },
          { name: "ws_ping_ms", sql: "ws_ping_ms INT NULL" },
        ];

    for (const col of botStatusColumns) {
      if (!(await columnExists(db, "bot_status", col.name, isSqlite))) {
        await db.query(`ALTER TABLE bot_status ADD COLUMN ${col.sql}`);
        applied.push(`bot_status.${col.name} column`);
        console.log(`db: migration applied: added bot_status.${col.name} column`);
      }
    }
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
  }

  if (applied.length === 0) {
    console.log("db: schema valid; no migrations applied");
  } else {
    console.log(
      `db: schema updated; ${applied.length} migration(s) applied: ${applied.join(", ")}`,
    );
  }
}
