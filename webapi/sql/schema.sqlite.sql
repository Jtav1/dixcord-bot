-- SQLite schema for api_template

-- Users (for authentication and profile)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TRIGGER IF NOT EXISTS users_updated_at
  AFTER UPDATE ON users WHEN OLD.updated_at = NEW.updated_at
  BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
  END;


-- Bot response tables (shared with dixcord-bot when using same DB)
CREATE TABLE IF NOT EXISTS configurations (
  config TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS take_a_look_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link TEXT UNIQUE,
  isdefault INTEGER DEFAULT 0,
  frequency INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS eight_ball_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_string TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  frequency INTEGER DEFAULT 0,
  UNIQUE (response_string, sentiment)
);

CREATE TABLE IF NOT EXISTS plusplus_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  string TEXT,
  voter TEXT,
  timestamp TEXT DEFAULT (datetime('now')),
  value TEXT
);

CREATE TABLE IF NOT EXISTS emoji_frequency (
  emoid TEXT PRIMARY KEY,
  emoji TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 0,
  animated INTEGER DEFAULT 0,
  type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sticker_frequency (
  stickerid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_emoji_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userid TEXT NOT NULL,
  emoid TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  UNIQUE (userid, emoid)
);

CREATE TABLE IF NOT EXISTS pin_history (
  msgid TEXT PRIMARY KEY,
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS link_replacements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_host TEXT NOT NULL UNIQUE,
  target_host TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pin_quips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quip TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Trigger strings and response strings (e.g. "take a look" triggers -> random image/link)
CREATE TABLE IF NOT EXISTS trigger_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_string TEXT NOT NULL,
  response_string TEXT NOT NULL,
  response_order INTEGER NULL,
  selection_mode TEXT NOT NULL DEFAULT 'random' CHECK (selection_mode IN ('random', 'ordered')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Round-robin state: last-used response id per trigger
CREATE TABLE IF NOT EXISTS trigger_response_state (
  trigger_string TEXT PRIMARY KEY,
  last_used_response_id INTEGER NULL
);
