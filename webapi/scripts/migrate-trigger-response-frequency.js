/**
 * Migration: add frequency column (DEFAULT 0) to triggers, responses, and trigger_response.
 * Safe to run on DBs that already have the column.
 *
 * Run from webapi dir: node scripts/migrate-trigger-response-frequency.js
 */
import "dotenv/config";
import db from "../config/db.js";

const isSqlite = (process.env.DB_TYPE || "mysql").toLowerCase() === "sqlite";

async function addColumn(table, columnDef) {
  if (isSqlite) {
    try {
      await db.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
      console.log(`Added ${table}.frequency`);
    } catch (e) {
      if (!e.message?.includes("duplicate column")) console.warn(e.message);
    }
  } else {
    try {
      await db.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
      console.log(`Added ${table}.frequency`);
    } catch (e) {
      if (e.code !== "ER_DUP_FIELDNAME") throw e;
    }
  }
}

async function run() {
  try {
    if (isSqlite) {
      await addColumn("triggers", "frequency INTEGER DEFAULT 0");
      await addColumn("responses", "frequency INTEGER DEFAULT 0");
      await addColumn("trigger_response", "frequency INTEGER DEFAULT 0");
    } else {
      await addColumn("triggers", "frequency INT DEFAULT 0");
      await addColumn("responses", "frequency INT DEFAULT 0");
      await addColumn("trigger_response", "frequency INT DEFAULT 0");
    }
    console.log("Migration done.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
  process.exit(0);
}

run();
