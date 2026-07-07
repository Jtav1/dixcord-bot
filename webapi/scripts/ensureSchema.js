/**
 * Apply incremental schema migrations for admin-panel backend features.
 * Safe to run on every startup (idempotent).
 */

import db from "../config/db.js";
import {
  columnExists,
  constraintExists,
  isSqliteDb,
  tableExists,
} from "./schemaUtils.js";

const isSqlite = isSqliteDb();

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
    await db.query(
      "INSERT INTO configurations (config, value) VALUES (?, ?)",
      ["pin_message_role_ids", '["612842488302141441"]'],
    );
    applied.push("pin_message_role_ids configuration seed");
    console.log(
      "db: migration applied: seeded pin_message_role_ids configuration",
    );
  } else {
    console.log(
      "db: schema ok: pin_message_role_ids configuration already exists",
    );
  }

  if (applied.length === 0) {
    console.log("db: schema valid; no migrations applied");
  } else {
    console.log(
      `db: schema updated; ${applied.length} migration(s) applied: ${applied.join(", ")}`,
    );
  }
}
