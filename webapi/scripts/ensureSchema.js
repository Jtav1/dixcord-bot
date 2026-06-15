/**
 * Apply incremental schema migrations for admin-panel backend features.
 * Safe to run on every startup (idempotent).
 */

import db from "../config/db.js";

const DB_TYPE = (process.env.DB_TYPE || "mysql").toLowerCase();
const isSqlite = DB_TYPE === "sqlite";

/**
 * Check if a column exists on a table (SQLite).
 * @param {string} table
 * @param {string} column
 * @returns {Promise<boolean>}
 */
async function sqliteColumnExists(table, column) {
  try {
    await db.query(`SELECT "${column}" FROM ${table} LIMIT 0`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a table exists.
 * @param {string} table
 * @returns {Promise<boolean>}
 */
async function tableExists(table) {
  if (isSqlite) {
    const [rows] = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
      [table],
    );
    return Array.isArray(rows) && rows.length > 0;
  }
  const [rows] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    [table],
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Run all pending migrations.
 * @returns {Promise<void>}
 */
export async function ensureSchemaMigrations() {
  // users.role column
  if (isSqlite) {
    if (!(await sqliteColumnExists("users", "role"))) {
      await db.query(
        "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'",
      );
    }
  } else {
    try {
      await db.query(
        "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'admin'",
      );
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") throw err;
    }
  }

  // audit_log table
  if (!(await tableExists("audit_log"))) {
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
  }

  // bot_status table
  if (!(await tableExists("bot_status"))) {
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
  }

  // system_state table
  if (!(await tableExists("system_state"))) {
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
  }
}
