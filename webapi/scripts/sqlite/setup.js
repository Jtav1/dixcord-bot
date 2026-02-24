/**
 * SQLite database setup for dixcord-bot: initialization + default data import.
 * Mirrors database/initialize.js and database/import.js from the main bot.
 *
 * Run: npm run db:setup:sqlite
 * Requires: DB_FILE in .env (or defaults to ./data/api_template.sqlite)
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let Database;
try {
  const betterSqlite3 = await import('better-sqlite3');
  Database = betterSqlite3.default;
} catch (e) {
  console.error(
    'better-sqlite3 is not installed. Run: npm install better-sqlite3'
  );
  process.exit(1);
}

const dbPath =
  process.env.DB_FILE || path.join(__dirname, '..', '..', 'data', 'api_template.sqlite');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// --- Initialize (create tables) ---
const exec = (sql) => {
  try {
    db.exec(sql);
  } catch (err) {
    console.error('db: exec error', err.message);
    throw err;
  }
};

const initializeDatabase = () => {
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
      frequency INTEGER NOT NULL,
      animated INTEGER,
      type TEXT NOT NULL
    )
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS pin_history (
      msgid TEXT PRIMARY KEY,
      timestamp TEXT DEFAULT (datetime('now'))
    )
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS take_a_look_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link TEXT UNIQUE,
      isdefault INTEGER DEFAULT 0,
      frequency INTEGER DEFAULT 0
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
    CREATE TABLE IF NOT EXISTS log_filter_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT UNIQUE
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
    CREATE TABLE IF NOT EXISTS user_lookup (
      userid TEXT NOT NULL,
      username TEXT NOT NULL,
      handle TEXT NOT NULL,
      PRIMARY KEY (userid, username)
    )
  `);

  console.log('db: SQLite table initialization complete');
};

// --- Import (seed default configs) ---
const envOrDefault = (envKey, defaultVal) =>
  envKey in process.env ? process.env[envKey] : defaultVal;

const importConfigs = () => {
  const isDev = process.env.NODE_ENV !== 'production';
  const defaultDelay = Math.floor(Math.random() * 60000 + 60000);
  const defaultPinThreshold = isDev ? 1 : 3;
  const defaultPinChannelId = isDev ? '710671234471559228' : '915462110761349201';
  const defaultAnnounceChannelId = isDev ? '710671234471559228' : '911427650730487878';

  const configArray = [
    ['rare_frequency', envOrDefault('RARE_FREQUENCY', '0.1')],
    ['twitter_fix_enabled', envOrDefault('TWITTER_FIX_ENABLED', 'true')],
    ['pin_threshold', envOrDefault('PIN_THRESHOLD', String(defaultPinThreshold))],
    ['pin_emoji', envOrDefault('PIN_EMOJI', '\ud83d\udccc')],
    ['repost_emoji', envOrDefault('REPOST_EMOJI', '1072368151922233404')],
    ['announce_channel_id', envOrDefault('ANNOUNCE_CHANNEL_ID', defaultAnnounceChannelId)],
    ['take_a_look_delay', envOrDefault('TAKE_A_LOOK_DELAY', String(defaultDelay))],
    ['take_a_look_repost_limit', envOrDefault('TAKE_A_LOOK_REPOST_LIMIT', '2')],
    ['pin_channel_id', envOrDefault('PIN_CHANNEL_ID', defaultPinChannelId)],
    ['plusplus_emoji', envOrDefault('PLUSPLUS_EMOJI', '1333222614033760326')],
    ['minusminus_emoji', envOrDefault('MINUSMINUS_EMOJI', '1333222612683194442')],
    ['timeout_emoji', envOrDefault('TIMEOUT_EMOJI', null)],
    ['timeout_vote_threshold', envOrDefault('TIMEOUT_VOTE_THRESHOLD', '5')],
  ];

  const insert = db.prepare(
    'INSERT OR IGNORE INTO configurations (config, value) VALUES (?, ?)'
  );
  const insertMany = db.transaction((entries) => {
    for (const [config, value] of entries) {
      insert.run(config, value);
    }
  });
  insertMany(configArray);

  console.log('db: SQLite configuration import complete');
};

// --- Run ---
try {
  initializeDatabase();
  importConfigs();
  db.close();
  process.exit(0);
} catch (err) {
  console.error(err);
  db.close();
  process.exit(1);
}
