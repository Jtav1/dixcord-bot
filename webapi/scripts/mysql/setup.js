/**
 * MySQL database setup for dixcord-bot: applies sql/schema.sql (the same source of truth
 * ensureSchemaMigrations() reconciles against on every boot), runs it, then seeds pin_quips
 * and link_replacements default data — the one thing not already handled elsewhere.
 *
 * Run: npm run db:setup:mysql  or  npm run db:migrate:mysql
 * Requires: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in .env
 */
import "dotenv/config";

// Force DB_TYPE so ensureSchemaMigrations() (which opens its own connection via
// config/db.js, keyed off this env var) definitely targets MySQL regardless of .env's value.
process.env.DB_TYPE = "mysql";

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import { ensureSchemaMigrations } from "../ensureSchema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "api_template",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 5,
  // Only this one-time setup script needs to run the whole schema file as one query.
  multipleStatements: true,
});

/**
 * Apply sql/schema.sql in full (every statement is CREATE TABLE/INDEX IF NOT EXISTS — safe
 * to re-run against an existing database).
 * @returns {Promise<void>}
 */
async function applySchema() {
  const schemaPath = path.join(__dirname, "..", "..", "sql", "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schema);
  console.log("db: MySQL schema.sql applied");
}

const DEFAULT_PIN_QUIPS = [
  "lmao saving this shit for later",
  "PINNED",
  "!!! MAJOR PIN ALERT !!!",
  "Dixbot will remember that...",
  "Lets FUCKING go dude I'm pinning this",
  "Alright, fine...",
  "Puttin a pin on this one",
  "^ pinned this btw",
  "Um... based? or cringe.",
  "I'm only going to pin it once this time",
];

/**
 * Seed default pin_quips rows if the table is empty.
 * @returns {Promise<void>}
 */
async function importPinQuips() {
  const [rows] = await pool.query("SELECT COUNT(*) AS count FROM pin_quips");
  if ((rows?.[0]?.count ?? 0) > 0) return;
  for (const quip of DEFAULT_PIN_QUIPS) {
    await pool.query("INSERT INTO pin_quips (quip) VALUES (?)", [quip]);
  }
  console.log("db: MySQL pin_quips seed complete");
}

const DEFAULT_LINK_REPLACEMENTS = [
  ["x.com", "fixvx.com"],
  ["twitter.com", "fixvx.com"],
  ["instagram.com", "jgram.jtav.me"],
  ["tiktok.com", "kktiktok.com"],
  ["bsky.app", "bskx.app"],
];

/**
 * Seed default link_replacements rows (no-op for any source_host already present).
 * @returns {Promise<void>}
 */
async function importLinkReplacements() {
  for (const [source_host, target_host] of DEFAULT_LINK_REPLACEMENTS) {
    await pool.query(
      "INSERT IGNORE INTO link_replacements (source_host, target_host) VALUES (?, ?)",
      [source_host, target_host],
    );
  }
  console.log("db: MySQL link_replacements import complete");
}

const run = async () => {
  try {
    await applySchema();
    // Same migrations + feature-toggle/guild_config seeding ensureSchemaMigrations() applies
    // on every boot — running it here covers anything schema.sql's CREATE TABLE IF NOT EXISTS
    // alone doesn't (column/constraint upgrades on a pre-existing install, config seeding).
    await ensureSchemaMigrations();
    await importPinQuips();
    await importLinkReplacements();
    await pool.end();
    console.log("db: MySQL setup complete");
    process.exit(0);
  } catch (err) {
    console.error(err);
    await pool.end();
    process.exit(1);
  }
};

run();
