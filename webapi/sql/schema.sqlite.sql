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

CREATE TABLE IF NOT EXISTS chat_member_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  discord_handle TEXT NOT NULL UNIQUE,
  discord_id TEXT NOT NULL UNIQUE
);

-- Bot response tables (shared with dixcord-bot when using same DB)
CREATE TABLE IF NOT EXISTS configurations (
  config TEXT PRIMARY KEY,
  value TEXT
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
  voter INTEGER REFERENCES chat_member_mapping(id) ON DELETE SET NULL,
  timestamp TEXT DEFAULT (datetime('now')),
  value TEXT
);

CREATE TABLE IF NOT EXISTS emoji_frequency (
  emoid TEXT PRIMARY KEY,
  emoji TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 0,
  animated INTEGER DEFAULT 0,
  type TEXT DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS sticker_frequency (
  stickerid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  frequency INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_emoji_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userid INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
  emoid TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  UNIQUE (userid, emoid)
);

CREATE TABLE IF NOT EXISTS user_repost_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userid INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
  msgid TEXT NOT NULL,
  accuser INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
  timestamp TEXT DEFAULT (datetime('now')),
  msgcontents TEXT,
  UNIQUE (userid, msgid, accuser)
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

-- Triggers: one row per unique trigger string (selection_mode for random vs ordered)
CREATE TABLE IF NOT EXISTS triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_string TEXT NOT NULL UNIQUE,
  selection_mode TEXT NOT NULL DEFAULT 'random' CHECK (selection_mode IN ('random', 'ordered', 'weighted')),
  created_at TEXT DEFAULT (datetime('now')),
  frequency INTEGER DEFAULT 0
);

-- Responses: reusable response strings (many-to-many with triggers via trigger_response)
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_string TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  frequency INTEGER DEFAULT 0
);

-- Junction: which responses belong to which trigger, with optional order and weight (0-100 or null)
CREATE TABLE IF NOT EXISTS trigger_response (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_id INTEGER NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
  response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  response_order INTEGER NULL,
  weight INTEGER NULL DEFAULT NULL CHECK (weight IS NULL OR (weight >= 0 AND weight <= 100)),
  frequency INTEGER DEFAULT 0,
  UNIQUE (trigger_id, response_id)
);

-- Round-robin state: last-used response_order per trigger (for ordered selection)
CREATE TABLE IF NOT EXISTS trigger_response_state (
  trigger_id INTEGER PRIMARY KEY REFERENCES triggers(id) ON DELETE CASCADE,
  last_used_response_order INTEGER NULL
);

-- Scheduled messages (bot polls due rows and posts to channel). Requester is chat_member_mapping.id.
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
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due ON scheduled_messages (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user ON scheduled_messages (user_id, status);
