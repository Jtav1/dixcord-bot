/**
 * One-off migration: add response_order and selection_mode to trigger_responses,
 * create trigger_response_state table, and prepopulate trigger_responses with default triggers.
 * Safe to run on DBs that already have these.
 *
 * Run from webapi dir: node scripts/migrate-trigger-response-order.js
 */
import "dotenv/config";
import db from "../config/db.js";

const isSqlite = (process.env.DB_TYPE || "mysql").toLowerCase() === "sqlite";

const PREPOPULATE_TRIGGERS = [
  "takealookatthis",
  "takenalookatthis",
  "tookalookatthis",
  "takingalookatthis",
  "takealookatthese",
  "takealookatdeez",
  "takealookatdis",
  "captaintake",
  "tookalookatthat",
  "takenalookatthese",
];

async function run() {
  try {
    if (isSqlite) {
      // SQLite: add columns if missing (SQLite doesn't have IF NOT EXISTS for columns)
      try {
        await db.query(
          "ALTER TABLE trigger_responses ADD COLUMN response_order INTEGER NULL",
        );
        console.log("Added trigger_responses.response_order");
      } catch (e) {
        if (!e.message?.includes("duplicate column")) console.warn(e.message);
      }
      try {
        await db.query(
          "ALTER TABLE trigger_responses ADD COLUMN selection_mode TEXT NOT NULL DEFAULT 'random'",
        );
        console.log("Added trigger_responses.selection_mode");
      } catch (e) {
        if (!e.message?.includes("duplicate column")) console.warn(e.message);
      }
      await db.query(`
        CREATE TABLE IF NOT EXISTS trigger_response_state (
          trigger_string TEXT PRIMARY KEY,
          last_used_response_id INTEGER NULL
        )
      `);
      console.log("Ensured trigger_response_state table exists");
    } else {
      try {
        await db.query(
          "ALTER TABLE trigger_responses ADD COLUMN response_order INT NULL",
        );
        console.log("Added trigger_responses.response_order");
      } catch (e) {
        if (e.code !== "ER_DUP_FIELDNAME") throw e;
      }
      try {
        await db.query(
          "ALTER TABLE trigger_responses ADD COLUMN selection_mode VARCHAR(10) NOT NULL DEFAULT 'random'",
        );
        console.log("Added trigger_responses.selection_mode");
      } catch (e) {
        if (e.code !== "ER_DUP_FIELDNAME") throw e;
      }
      await db.query(`
        CREATE TABLE IF NOT EXISTS trigger_response_state (
          trigger_string VARCHAR(255) PRIMARY KEY,
          last_used_response_id INT NULL
        )
      `);
      console.log("Ensured trigger_response_state table exists");
    }

    // Prepopulate trigger_responses with default triggers (one row per trigger, placeholder response)
    for (const trigger of PREPOPULATE_TRIGGERS) {
      const [existing] = await db.query(
        "SELECT 1 FROM trigger_responses WHERE trigger_string = ? LIMIT 1",
        [trigger],
      );
      if (!existing?.length) {
        await db.query(
          "INSERT INTO trigger_responses (trigger_string, response_string, response_order, selection_mode) VALUES (?, ?, ?, ?)",
          [trigger, "", null, "random"],
        );
        console.log("Prepopulated trigger:", trigger);
      }
    }
    console.log("Migration done.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
  process.exit(0);
}

run();
