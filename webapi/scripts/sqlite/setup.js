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
import {
  columnExistsSync,
  indexExistsSync,
  tableExistsSync,
} from "../schemaUtils.js";

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
    CREATE TABLE IF NOT EXISTS chat_member_mapping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      discord_handle TEXT NOT NULL UNIQUE,
      discord_id TEXT NOT NULL UNIQUE
    )
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      msgid TEXT NOT NULL UNIQUE,
      timestamp TEXT DEFAULT (datetime('now')),
      author INTEGER NULL REFERENCES chat_member_mapping(id) ON DELETE SET NULL,
      contents TEXT NULL,
      attachments TEXT NULL,
      channel_id TEXT NULL,
      channel_name TEXT NULL,
      pinners TEXT NULL,
      hydrated INTEGER NOT NULL DEFAULT 1
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
      selection_mode TEXT NOT NULL DEFAULT 'random' CHECK (selection_mode IN ('random', 'ordered', 'weighted', 'lotto')),
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
      lotto_prize TEXT NULL,
      frequency INTEGER DEFAULT 0,
      UNIQUE (trigger_id, response_id)
    )
  `);
  exec(`
    CREATE TABLE IF NOT EXISTS trigger_lotto_prizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prize_string TEXT NOT NULL UNIQUE,
      frequency INTEGER DEFAULT 0
    )
  `);
  exec(`
    CREATE TABLE IF NOT EXISTS trigger_response_state (
      trigger_id INTEGER PRIMARY KEY REFERENCES triggers(id) ON DELETE CASCADE,
      last_used_response_order INTEGER NULL
    )
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
      discord_channel_id TEXT NOT NULL,
      discord_guild_id TEXT,
      message_body TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
      sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  exec(
    "CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due ON scheduled_messages (status, scheduled_at)",
  );
  exec(
    "CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user ON scheduled_messages (user_id, status)",
  );

  migrateTables();

  console.log("db: SQLite table initialization complete");
};

/**
 * Apply incremental column and table migrations idempotently.
 */
const migrateTables = () => {
  if (tableExistsSync(db, "users") && !columnExistsSync(db, "users", "role")) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'");
  }

  if (!tableExistsSync(db, "audit_log")) {
    exec(`
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
  }

  if (!tableExistsSync(db, "bot_status")) {
    exec(`
      CREATE TABLE bot_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL UNIQUE,
        version TEXT NOT NULL,
        last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  if (!tableExistsSync(db, "system_state")) {
    exec(`
      CREATE TABLE system_state (
        state_key TEXT PRIMARY KEY,
        state_value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  if (tableExistsSync(db, "user_repost_tracking")) {
    if (!columnExistsSync(db, "user_repost_tracking", "msgcontents")) {
      db.exec("ALTER TABLE user_repost_tracking ADD COLUMN msgcontents TEXT");
    }
  }

  if (tableExistsSync(db, "pin_history")) {
    const pinHistoryColumns = [
      {
        name: "author",
        sql: "author INTEGER NULL REFERENCES chat_member_mapping(id) ON DELETE SET NULL",
      },
      { name: "contents", sql: "contents TEXT NULL" },
      { name: "attachments", sql: "attachments TEXT NULL" },
      { name: "channel_id", sql: "channel_id TEXT NULL" },
      { name: "channel_name", sql: "channel_name TEXT NULL" },
      { name: "pinners", sql: "pinners TEXT NULL" },
      { name: "hydrated", sql: "hydrated INTEGER NOT NULL DEFAULT 1" },
    ];

    for (const col of pinHistoryColumns) {
      if (!columnExistsSync(db, "pin_history", col.name)) {
        db.exec(`ALTER TABLE pin_history ADD COLUMN ${col.sql}`);
      }
    }
  }

  if (
    tableExistsSync(db, "scheduled_messages") &&
    !indexExistsSync(db, "scheduled_messages", "idx_scheduled_messages_due")
  ) {
    db.exec(
      "CREATE INDEX idx_scheduled_messages_due ON scheduled_messages (status, scheduled_at)",
    );
  }
  if (
    tableExistsSync(db, "scheduled_messages") &&
    !indexExistsSync(db, "scheduled_messages", "idx_scheduled_messages_user")
  ) {
    db.exec(
      "CREATE INDEX idx_scheduled_messages_user ON scheduled_messages (user_id, status)",
    );
  }
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
