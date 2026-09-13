-- SQLite schema for api_template

-- Users (for authentication and profile)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  guild_id TEXT NULL,
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

CREATE TABLE IF NOT EXISTS member_emoji_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userid INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
  emoid TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  UNIQUE (userid, emoid)
);

CREATE TABLE IF NOT EXISTS member_repost_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userid INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
  msgid TEXT NOT NULL,
  accuser INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
  timestamp TEXT DEFAULT (datetime('now')),
  msgcontents TEXT,
  UNIQUE (userid, msgid, accuser)
);

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

-- Catalog of trigger response function keys (referenced by trigger_response.response_function)
CREATE TABLE IF NOT EXISTS trigger_response_functions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  function_name TEXT NOT NULL UNIQUE,
  frequency INTEGER DEFAULT 0,
  display_name TEXT NULL
);

-- Junction: which responses belong to which trigger, with optional order and weight (0-100 or null)
CREATE TABLE IF NOT EXISTS trigger_response (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_id INTEGER NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
  response_id INTEGER NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  response_order INTEGER NULL,
  weight INTEGER NULL DEFAULT NULL CHECK (weight IS NULL OR (weight >= 0 AND weight <= 100)),
  response_function INTEGER NULL REFERENCES trigger_response_functions(id) ON DELETE SET NULL,
  response_function_parameters TEXT NULL,
  frequency INTEGER DEFAULT 0,
  UNIQUE (trigger_id, response_id)
);

-- Round-robin state: last-used response_order per trigger (for ordered selection)
CREATE TABLE IF NOT EXISTS trigger_response_state (
  trigger_id INTEGER PRIMARY KEY REFERENCES triggers(id) ON DELETE CASCADE,
  last_used_response_order INTEGER NULL
);

-- History: one row per (user, trigger_response) usage, for audit/analytics
CREATE TABLE IF NOT EXISTS trigger_response_user_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
  trigger_response_id INTEGER NOT NULL REFERENCES trigger_response(id) ON DELETE CASCADE,
  timestamp TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trigger_response_user_history_user ON trigger_response_user_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trigger_response_user_history_trigger_response ON trigger_response_user_history(trigger_response_id);

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

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bot_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  version TEXT NOT NULL,
  last_seen_at TEXT DEFAULT (datetime('now')),
  ready_at TEXT NULL,
  member_count INTEGER NULL,
  channel_count INTEGER NULL,
  ws_ping_ms INTEGER NULL,
  metrics_json TEXT NULL,
  UNIQUE (app, guild_id)
);

CREATE TABLE IF NOT EXISTS system_state (
  state_key TEXT PRIMARY KEY,
  state_value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Chat-platform guild snapshots (app-scoped: "discord" today, other chat platforms possible later)
CREATE TABLE IF NOT EXISTS guild_info (
  app TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon_url TEXT NULL,
  description TEXT NULL,
  owner_id TEXT NULL,
  boost_tier INTEGER NULL,
  boost_count INTEGER NULL,
  verification_level TEXT NULL,
  preferred_locale TEXT NULL,
  guild_created_at TEXT NULL,
  synced_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (app, guild_id)
);

CREATE TABLE IF NOT EXISTS guild_channels (
  app TEXT NOT NULL,
  id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NULL,
  position INTEGER NULL,
  parent_id TEXT NULL,
  synced_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (app, id)
);

CREATE INDEX IF NOT EXISTS idx_guild_channels_guild ON guild_channels (app, guild_id);

CREATE TABLE IF NOT EXISTS guild_roles (
  app TEXT NOT NULL,
  id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NULL,
  position INTEGER NULL,
  mentionable INTEGER NULL,
  hoisted INTEGER NULL,
  synced_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (app, id)
);

CREATE INDEX IF NOT EXISTS idx_guild_roles_guild ON guild_roles (app, guild_id);

-- Per-(app, guild_id) configuration/feature-flags; each server gets its own fully
-- independent set, superseding the single global `configurations` table above.
CREATE TABLE IF NOT EXISTS guild_config (
  app TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  config TEXT NOT NULL,
  value TEXT NULL,
  PRIMARY KEY (app, guild_id, config)
);

-- Per-(app, guild_id, platform_user_id) server membership: nickname/roles/joined-at held in
-- that server. chat_member_mapping stays the single global cross-server identity; the link is
-- optional (NULL until an admin/sync resolves it) so membership is never lost to an unknown id.
CREATE TABLE IF NOT EXISTS guild_members (
  app TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  chat_member_mapping_id INTEGER NULL REFERENCES chat_member_mapping(id) ON DELETE SET NULL,
  nickname TEXT NULL,
  roles TEXT NULL,
  joined_at TEXT NULL,
  synced_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (app, guild_id, platform_user_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_members_user ON guild_members (chat_member_mapping_id);
