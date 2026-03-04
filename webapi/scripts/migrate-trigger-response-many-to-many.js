/**
 * Migration: replace trigger_responses with triggers + responses + trigger_response (many-to-many).
 * - Creates triggers, responses, trigger_response tables (and trigger_response_state if missing).
 * - If trigger_responses exists: migrates data (dedupes responses by response_string), updates
 *   trigger_response_state.last_used_response_id to responses.id, then drops trigger_responses.
 *
 * Run from webapi dir: node scripts/migrate-trigger-response-many-to-many.js
 */
import "dotenv/config";
import db from "../config/db.js";

const isSqlite = (process.env.DB_TYPE || "mysql").toLowerCase() === "sqlite";

async function tableExists(name) {
  if (isSqlite) {
    const [rows] = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
      [name],
    );
    return rows && rows.length > 0;
  }
  const [rows] = await db.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [name],
  );
  return rows && rows.length > 0;
}

async function run() {
  try {
    // 1. Create new tables
    if (isSqlite) {
      await db.query(`
        CREATE TABLE IF NOT EXISTS triggers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trigger_string TEXT NOT NULL UNIQUE,
          selection_mode TEXT NOT NULL DEFAULT 'random' CHECK (selection_mode IN ('random', 'ordered')),
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS responses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          response_string TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS trigger_response (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trigger_id INTEGER NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
          response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
          response_order INTEGER NULL,
          UNIQUE (trigger_id, response_id)
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS trigger_response_state (
          trigger_string TEXT PRIMARY KEY,
          last_used_response_id INTEGER NULL
        )
      `);
    } else {
      await db.query(`
        CREATE TABLE IF NOT EXISTS triggers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          trigger_string VARCHAR(255) NOT NULL UNIQUE,
          selection_mode VARCHAR(10) NOT NULL DEFAULT 'random',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS responses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          response_string VARCHAR(500) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS trigger_response (
          id INT AUTO_INCREMENT PRIMARY KEY,
          trigger_id INT NOT NULL,
          response_id INT NOT NULL,
          response_order INT NULL,
          FOREIGN KEY (trigger_id) REFERENCES triggers(id) ON DELETE CASCADE,
          FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
          UNIQUE KEY unique_trigger_response (trigger_id, response_id)
        )
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS trigger_response_state (
          trigger_string VARCHAR(255) PRIMARY KEY,
          last_used_response_id INT NULL
        )
      `);
    }
    console.log("Ensured triggers, responses, trigger_response, trigger_response_state exist");

    const hasOldTable = await tableExists("trigger_responses");
    if (!hasOldTable) {
      console.log("No trigger_responses table found; migration (data copy) skipped.");
      process.exit(0);
      return;
    }

    // 2. Migrate data from trigger_responses
    const [oldRows] = await db.query(
      "SELECT id, trigger_string, response_string, response_order, selection_mode FROM trigger_responses",
    );
    if (!Array.isArray(oldRows) || oldRows.length === 0) {
      console.log("trigger_responses was empty; dropping.");
      await db.query("DROP TABLE trigger_responses");
      process.exit(0);
      return;
    }

    const triggerIdsByString = new Map();
    const responseIdsByString = new Map();

    for (const row of oldRows) {
      const trigger_string = row.trigger_string;
      const response_string = row.response_string ?? "";
      const response_order = row.response_order ?? null;
      const selection_mode = (row.selection_mode || "random").toLowerCase();

      let triggerId = triggerIdsByString.get(trigger_string);
      if (triggerId == null) {
        const [existing] = await db.query(
          "SELECT id FROM triggers WHERE trigger_string = ? LIMIT 1",
          [trigger_string],
        );
        if (existing && existing.length > 0) {
          triggerId = existing[0].id;
        } else {
          const [ins] = await db.query(
            "INSERT INTO triggers (trigger_string, selection_mode) VALUES (?, ?)",
            [trigger_string, selection_mode],
          );
          triggerId = isSqlite ? ins?.lastInsertRowid : ins?.insertId;
        }
        if (triggerId != null) triggerIdsByString.set(trigger_string, triggerId);
      }

      let responseId = responseIdsByString.get(response_string);
      if (responseId == null) {
        const [existing] = await db.query(
          "SELECT id FROM responses WHERE response_string = ? LIMIT 1",
          [response_string],
        );
        if (existing && existing.length > 0) {
          responseId = existing[0].id;
        } else {
          const [ins] = await db.query(
            "INSERT INTO responses (response_string) VALUES (?)",
            [response_string],
          );
          responseId = isSqlite ? ins?.lastInsertRowid : ins?.insertId;
        }
        if (responseId != null) responseIdsByString.set(response_string, responseId);
      }

      if (triggerId != null && responseId != null) {
        const insertSql = isSqlite
          ? "INSERT OR IGNORE INTO trigger_response (trigger_id, response_id, response_order) VALUES (?, ?, ?)"
          : "INSERT IGNORE INTO trigger_response (trigger_id, response_id, response_order) VALUES (?, ?, ?)";
        await db.query(insertSql, [triggerId, responseId, response_order]);
      }
    }
    console.log("Migrated", oldRows.length, "rows into triggers/responses/trigger_response");

    // 3. Update trigger_response_state: old last_used_response_id was trigger_responses.id
    const [stateRows] = await db.query(
      "SELECT trigger_string, last_used_response_id FROM trigger_response_state WHERE last_used_response_id IS NOT NULL",
    );
    const oldIdToRow = new Map(oldRows.map((r) => [Number(r.id), r]));

    for (const s of stateRows || []) {
      const oldId = s.last_used_response_id != null ? Number(s.last_used_response_id) : null;
      if (oldId == null) continue;
      const oldRow = oldIdToRow.get(oldId);
      if (!oldRow) continue;
      const response_string = oldRow.response_string ?? "";
      const newResponseId = responseIdsByString.get(response_string);
      if (newResponseId == null) continue;
      await db.query(
        "UPDATE trigger_response_state SET last_used_response_id = ? WHERE trigger_string = ?",
        [newResponseId, s.trigger_string],
      );
    }
    console.log("Updated trigger_response_state last_used_response_id to responses.id");

    // 4. Drop old table
    await db.query("DROP TABLE trigger_responses");
    console.log("Dropped trigger_responses.");
    console.log("Migration done.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
  process.exit(0);
}

run();
