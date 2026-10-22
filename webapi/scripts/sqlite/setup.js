/**
 * SQLite database setup for dixcord-bot: applies sql/schema.sqlite.sql (the same source of
 * truth ensureSchemaMigrations() reconciles against on every boot), runs it, then seeds
 * pin_quips and link_replacements default data — the one thing not already handled elsewhere.
 *
 * Run: npm run db:setup:sqlite
 * Requires: DB_FILE in .env (or defaults to ./data/api_template.sqlite)
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath =
  process.env.DB_FILE ||
  path.join(__dirname, "..", "..", "data", "api_template.sqlite");
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
console.log("db: SQLite database path:", dbPath);

// Force DB_TYPE/DB_FILE so ensureSchemaMigrations() (which opens its own connection via
// config/db.js) definitely targets this same file, regardless of .env's value.
process.env.DB_TYPE = "sqlite";
process.env.DB_FILE = dbPath;

let Database;
try {
  const betterSqlite3 = await import("better-sqlite3");
  Database = betterSqlite3.default;
} catch (e) {
  console.error(
    "better-sqlite3 is not installed. Run: npm install better-sqlite3",
  );
  process.exit(1);
}

const { ensureSchemaMigrations } = await import("../ensureSchema.js");

const db = new Database(dbPath);

/**
 * Apply sql/schema.sqlite.sql in full (every statement is CREATE TABLE/INDEX IF NOT EXISTS —
 * safe to re-run against an existing database). better-sqlite3's exec() runs the whole
 * multi-statement file in one call, same as config/db.js's own fresh-file auto-init.
 * @returns {void}
 */
const applySchema = () => {
  const schemaPath = path.join(__dirname, "..", "..", "sql", "schema.sqlite.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);
  console.log("db: SQLite schema.sqlite.sql applied");
};

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
 * @returns {void}
 */
const importPinQuips = () => {
  const count = db.prepare("SELECT COUNT(*) as c FROM pin_quips").get();
  if (count && count.c > 0) return;
  const insert = db.prepare("INSERT INTO pin_quips (quip) VALUES (?)");
  const insertMany = db.transaction((quips) => {
    for (const quip of quips) insert.run(quip);
  });
  insertMany(DEFAULT_PIN_QUIPS);
  console.log("db: SQLite pin_quips seed complete");
};

const DEFAULT_LINK_REPLACEMENTS = [
  ["x.com", "fixvx.com"],
  ["twitter.com", "fixvx.com"],
  ["instagram.com", "jgram.jtav.me"],
  ["tiktok.com", "kktiktok.com"],
  ["bsky.app", "bskx.app"],
];

/**
 * Seed default link_replacements rows (no-op for any source_host already present).
 * @returns {void}
 */
const importLinkReplacements = () => {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO link_replacements (source_host, target_host) VALUES (?, ?)",
  );
  const insertMany = db.transaction((entries) => {
    for (const [source_host, target_host] of entries) insert.run(source_host, target_host);
  });
  insertMany(DEFAULT_LINK_REPLACEMENTS);
  console.log("db: SQLite link_replacements import complete");
};

try {
  applySchema();
  // ensureSchemaMigrations() opens its own separate connection via config/db.js (same
  // DB_FILE, forced above) — same migrations + feature-toggle/guild_config seeding it
  // applies on every boot. better-sqlite3 allows multiple connections to one file, same as
  // config/db.js's own fresh-file auto-init running alongside the app's main connection.
  await ensureSchemaMigrations();
  importPinQuips();
  importLinkReplacements();
  db.close();
  console.log("db: SQLite setup complete");
  process.exit(0);
} catch (err) {
  console.error(err);
  db.close();
  process.exit(1);
}
