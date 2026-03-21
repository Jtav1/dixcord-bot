/**
 * SQLite database setup for dixcord-bot: initialization + default data import.
 * Mirrors database/initialize.js and database/import.js from the main bot.
 * Must include every table from dump (e.g. webapi/data/dump-dixbot-dev-*.sql) for smooth transition.
 *
 * Run: npm run db:setup:sqlite
 * Requires: DB_FILE in .env (or defaults to ./data/api_template.sqlite)
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const dbPath =
  process.env.DB_FILE ||
  path.join(__dirname, "..", "..", "data", "api_template.sqlite");
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
console.log("db: SQLite database path:", dbPath);

const db = new Database(dbPath);

// --- Initialize (create tables) ---
const exec = (sql) => {
  try {
    db.exec(sql);
  } catch (err) {
    console.error("db: exec error", err.message);
    throw err;
  }
};

const initializeDatabase = () => {
  // Users (for authentication and profile)
  exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  exec(`
    CREATE TRIGGER IF NOT EXISTS users_updated_at
      AFTER UPDATE ON users WHEN OLD.updated_at = NEW.updated_at
      BEGIN
        UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
      END
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS configurations (
      config TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS emoji_frequency (
      emoid TEXT NOT NULL PRIMARY KEY,
      emoji TEXT NOT NULL,
      frequency INTEGER NOT NULL DEFAULT 0,
      animated INTEGER,
      type TEXT
    )
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS sticker_frequency (
      stickerid TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      frequency INTEGER NOT NULL DEFAULT 0
    )
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS pin_history (
      msgid TEXT PRIMARY KEY,
      timestamp TEXT DEFAULT (datetime('now'))
    )
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS eight_ball_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      response_string TEXT NOT NULL,
      sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
      frequency INTEGER DEFAULT 0,
      UNIQUE (response_string, sentiment)
    )
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS user_emoji_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userid TEXT NOT NULL,
      emoid TEXT NOT NULL,
      frequency INTEGER DEFAULT 1,
      UNIQUE (userid, emoid),
      FOREIGN KEY (emoid) REFERENCES emoji_frequency(emoid)
    )
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS user_repost_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userid TEXT NOT NULL,
      msgid TEXT NOT NULL,
      accuser TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      msgcontents TEXT,
      UNIQUE (userid, msgid, accuser)
    )
  `);

  // Migration: add msgcontents if table existed before this column was added
  try {
    const info = db.prepare("PRAGMA table_info(user_repost_tracking)").all();
    if (info && !info.some((c) => c.name === "msgcontents")) {
      db.exec("ALTER TABLE user_repost_tracking ADD COLUMN msgcontents TEXT");
    }
  } catch (_) {}

  exec(`
    CREATE TABLE IF NOT EXISTS plusplus_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      string TEXT,
      voter TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      value TEXT
    )
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS link_replacements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_host TEXT NOT NULL UNIQUE,
      target_host TEXT NOT NULL
    )
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS pin_quips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quip TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Trigger-response: triggers, responses, junction, round-robin state
  exec(`
    CREATE TABLE IF NOT EXISTS triggers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_string TEXT NOT NULL UNIQUE,
      selection_mode TEXT NOT NULL DEFAULT 'random' CHECK (selection_mode IN ('random', 'ordered')),
      created_at TEXT DEFAULT (datetime('now')),
      frequency INTEGER DEFAULT 0
    )
  `);
  exec(`
    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      response_string TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      frequency INTEGER DEFAULT 0
    )
  `);
  exec(`
    CREATE TABLE IF NOT EXISTS trigger_response (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_id INTEGER NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
      response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
      response_order INTEGER NULL,
      weight INTEGER NULL DEFAULT NULL CHECK (weight IS NULL OR (weight >= 0 AND weight <= 100)),
      frequency INTEGER DEFAULT 0,
      UNIQUE (trigger_id, response_id)
    )
  `);
  exec(`
    CREATE TABLE IF NOT EXISTS trigger_response_state (
      trigger_id INTEGER PRIMARY KEY REFERENCES triggers(id) ON DELETE CASCADE,
      last_used_response_order INTEGER NULL
    )
  `);

  console.log("db: SQLite table initialization complete");
};

// --- Import (seed default configs) ---
const envOrDefault = (envKey, defaultVal) =>
  envKey in process.env ? process.env[envKey] : defaultVal;

const importConfigs = () => {
  const isDev = process.env.NODE_ENV !== "production";
  const defaultDelay = Math.floor(Math.random() * 60000 + 60000);
  const defaultPinThreshold = isDev ? 1 : 3;
  const defaultPinChannelId = isDev
    ? "710671234471559228"
    : "915462110761349201";
  const defaultAnnounceChannelId = isDev
    ? "710671234471559228"
    : "911427650730487878";

  const configArray = [
    ["rare_frequency", envOrDefault("RARE_FREQUENCY", "0.1")],
    ["twitter_fix_enabled", envOrDefault("TWITTER_FIX_ENABLED", "true")],
    [
      "pin_threshold",
      envOrDefault("PIN_THRESHOLD", String(defaultPinThreshold)),
    ],
    ["pin_emoji", envOrDefault("PIN_EMOJI", "\ud83d\udccc")],
    ["repost_emoji", envOrDefault("REPOST_EMOJI", "1072368151922233404")],
    [
      "announce_channel_id",
      envOrDefault("ANNOUNCE_CHANNEL_ID", defaultAnnounceChannelId),
    ],
    [
      "take_a_look_delay",
      envOrDefault("TAKE_A_LOOK_DELAY", String(defaultDelay)),
    ],
    ["take_a_look_repost_limit", envOrDefault("TAKE_A_LOOK_REPOST_LIMIT", "2")],
    ["pin_channel_id", envOrDefault("PIN_CHANNEL_ID", defaultPinChannelId)],
    ["plusplus_emoji", envOrDefault("PLUSPLUS_EMOJI", "1333222614033760326")],
    [
      "minusminus_emoji",
      envOrDefault("MINUSMINUS_EMOJI", "1333222612683194442"),
    ],
    ["timeout_emoji", envOrDefault("TIMEOUT_EMOJI", null)],
    ["timeout_vote_threshold", envOrDefault("TIMEOUT_VOTE_THRESHOLD", "5")],
  ];

  const insert = db.prepare(
    "INSERT OR IGNORE INTO configurations (config, value) VALUES (?, ?)",
  );
  const insertMany = db.transaction((entries) => {
    for (const [config, value] of entries) {
      insert.run(config, value);
    }
  });
  insertMany(configArray);

  console.log("db: SQLite configuration import complete");
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

const importPinQuips = () => {
  const count = db.prepare("SELECT COUNT(*) as c FROM pin_quips").get();
  if (count && count.c > 0) return;
  const insert = db.prepare("INSERT INTO pin_quips (quip) VALUES (?)");
  const insertMany = db.transaction((quips) => {
    for (const quip of quips) {
      insert.run(quip);
    }
  });
  insertMany(DEFAULT_PIN_QUIPS);
  console.log("db: SQLite pin_quips seed complete");
};

const importLinkReplacements = () => {
  const defaultLinkReplacements = [
    ["x.com", "fixvx.com"],
    ["twitter.com", "fixvx.com"],
    ["instagram.com", "jgram.jtav.me"],
    ["tiktok.com", "kktiktok.com"],
    ["bsky.app", "bskx.app"],
  ];
  const insert = db.prepare(
    "INSERT OR IGNORE INTO link_replacements (source_host, target_host) VALUES (?, ?)",
  );
  const insertMany = db.transaction((entries) => {
    for (const [source_host, target_host] of entries) {
      insert.run(source_host, target_host);
    }
  });
  insertMany(defaultLinkReplacements);
  console.log("db: SQLite link_replacements import complete");
};

// --- Run ---
try {
  initializeDatabase();
  importConfigs();
  importPinQuips();
  importLinkReplacements();
  db.close();
  process.exit(0);
} catch (err) {
  console.error(err);
  db.close();
  process.exit(1);
}
