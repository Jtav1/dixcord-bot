

-- Users (for authentication and profile)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  guild_id VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_member_mapping (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bot response tables (shared with dixcord-bot when using same DB)
CREATE TABLE IF NOT EXISTS configurations (
  config VARCHAR(255) PRIMARY KEY,
  value VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS eight_ball_responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  response_string VARCHAR(500) NOT NULL,
  sentiment ENUM('positive', 'negative', 'neutral') NOT NULL,
  frequency INT DEFAULT 0,
  UNIQUE KEY unique_response (response_string, sentiment)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plusplus_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(10) NOT NULL,
  string VARCHAR(500) DEFAULT NULL,
  voter INT DEFAULT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  value VARCHAR(500) DEFAULT NULL,
  CONSTRAINT fk_plusplus_voter FOREIGN KEY (voter) REFERENCES chat_member_mapping(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Emoji/sticker catalog identity: one row per known emoji, custom or unicode. Custom Discord
-- emoji: app="discord" + a real guild_id (owning guild). Unicode emoji: app/guild_id both NULL
-- (cross-platform, no owner). Fully replaced per-guild on each emoji-import sync (mirrors
-- guild_channels/guild_roles); unicode rows are added lazily on first use, never synced from Discord
-- (no such API exists — see discord-bot/api/emojis.js).
CREATE TABLE IF NOT EXISTS guild_emojis (
  id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin PRIMARY KEY, -- exact-match identity (custom snowflake or unicode emoji char); a linguistic _ci collation treats many distinct emoji as equal
  app VARCHAR(20) NULL,
  guild_id VARCHAR(64) NULL,
  type VARCHAR(50) NULL,              -- "emoji" | "sticker" | NULL (unicode); scopes the per-kind full-replace sync
  name VARCHAR(255) NOT NULL,
  animated TINYINT(1) DEFAULT 0,
  available TINYINT(1) NULL,
  managed TINYINT(1) NULL,
  requires_colons TINYINT(1) NULL,
  roles TEXT NULL,
  frequency INT NOT NULL DEFAULT 0,   -- synced from emoji_frequency by discord-bot/scripts/sync-emoji-frequency.js
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_guild_emojis_guild (app, guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-guild usage counter for any emoji/sticker seen in a message/reaction. `type` classifies the
-- row (emoji/sticker/unicode) for leaderboard filtering; display identity (name, animated) lives
-- in guild_emojis, joined via emoid.
-- emoid is a soft reference to guild_emojis.id, deliberately NOT a real FK: guild_emojis is fully
-- replaced (delete+insert) on every catalog sync, and emoid is part of this table's PRIMARY KEY
-- (so it can't be nulled out) — a real FK with ON DELETE CASCADE would silently destroy usage
-- history the moment an emoji/sticker is removed from Discord. Missing catalog rows resolve to a
-- placeholder object at read time (see attachEmojiObjects), matching guild_channels/guild_roles.
CREATE TABLE IF NOT EXISTS emoji_frequency (
  app VARCHAR(20) NOT NULL,
  guild_id VARCHAR(64) NOT NULL,
  emoid VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  frequency INT NOT NULL DEFAULT 0,
  type VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (app, guild_id, emoid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sticker_frequency (
  stickerid VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  frequency INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pin_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  msgid VARCHAR(255) NOT NULL UNIQUE,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  author INT NULL,
  contents VARCHAR(5000) NULL,
  attachments TEXT NULL,
  channel_id VARCHAR(32) NULL,
  channel_name VARCHAR(100) NULL,
  pinners TEXT NULL,
  hydrated TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_pin_history_author FOREIGN KEY (author) REFERENCES chat_member_mapping(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_emoji_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userid INT NOT NULL,
  emoid VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  frequency INT DEFAULT 1,
  UNIQUE KEY unique_user_emoji (userid, emoid),
  CONSTRAINT fk_user_emoji_userid FOREIGN KEY (userid) REFERENCES chat_member_mapping(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS member_repost_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userid INT NOT NULL,
  msgid VARCHAR(500) NOT NULL,
  accuser INT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  msgcontents TEXT DEFAULT NULL,
  UNIQUE KEY unique_repost_accusation (userid, msgid, accuser),
  CONSTRAINT fk_repost_userid FOREIGN KEY (userid) REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
  CONSTRAINT fk_repost_accuser FOREIGN KEY (accuser) REFERENCES chat_member_mapping(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS link_replacements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_host VARCHAR(255) NOT NULL UNIQUE,
  target_host VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pin_quips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quip VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Triggers: one row per unique trigger string (selection_mode for random vs ordered)
CREATE TABLE IF NOT EXISTS triggers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trigger_string VARCHAR(255) NOT NULL UNIQUE,
  selection_mode VARCHAR(10) NOT NULL DEFAULT 'random' CHECK (selection_mode IN ('random', 'ordered', 'weighted')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  frequency INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Responses: reusable response strings (many-to-many with triggers via trigger_response)
CREATE TABLE IF NOT EXISTS responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  response_string VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  frequency INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Catalog of trigger response function keys (referenced by trigger_response.response_function)
CREATE TABLE IF NOT EXISTS trigger_response_functions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  function_name VARCHAR(255) NOT NULL UNIQUE,
  frequency INT DEFAULT 0,
  display_name VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Junction: which responses belong to which trigger, with optional order and weight (0-100 or null)
CREATE TABLE IF NOT EXISTS trigger_response (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trigger_id INT NOT NULL,
  response_id INT NOT NULL,
  response_order INT NULL,
  weight INT NULL DEFAULT NULL,
  response_function INT NULL,
  response_function_parameters TEXT NULL,
  frequency INT DEFAULT 0,
  FOREIGN KEY (trigger_id) REFERENCES triggers(id) ON DELETE CASCADE,
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
  CONSTRAINT fk_trigger_response_response_function FOREIGN KEY (response_function) REFERENCES trigger_response_functions(id) ON DELETE SET NULL,
  UNIQUE KEY unique_trigger_response (trigger_id, response_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Round-robin state: last-used response_order per trigger (for ordered selection)
CREATE TABLE IF NOT EXISTS trigger_response_state (
  trigger_id INT PRIMARY KEY,
  last_used_response_order INT NULL,
  FOREIGN KEY (trigger_id) REFERENCES triggers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- History: one row per (user, trigger_response) usage, for audit/analytics
CREATE TABLE IF NOT EXISTS trigger_response_user_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  trigger_response_id INT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_trigger_response_user_history_user (user_id),
  KEY idx_trigger_response_user_history_trigger_response (trigger_response_id),
  CONSTRAINT fk_trigger_response_user_history_user FOREIGN KEY (user_id) REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
  CONSTRAINT fk_trigger_response_user_history_trigger_response FOREIGN KEY (trigger_response_id) REFERENCES trigger_response(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Scheduled messages (bot polls due rows and posts to channel). Requester is chat_member_mapping.id (per-app user rows).
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  discord_channel_id VARCHAR(32) NOT NULL,
  discord_guild_id VARCHAR(32) NULL,
  message_body TEXT NOT NULL,
  scheduled_at DATETIME NOT NULL,
  status ENUM('pending', 'sent') NOT NULL DEFAULT 'pending',
  sent_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_scheduled_messages_due (status, scheduled_at),
  KEY idx_scheduled_messages_user (user_id, status),
  CONSTRAINT fk_scheduled_messages_user FOREIGN KEY (user_id) REFERENCES chat_member_mapping(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255) NULL,
  details TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bot_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app VARCHAR(20) NOT NULL,
  guild_id VARCHAR(32) NOT NULL,
  version VARCHAR(50) NOT NULL,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ready_at TIMESTAMP NULL,
  member_count INT NULL,
  channel_count INT NULL,
  ws_ping_ms INT NULL,
  metrics_json TEXT NULL,
  UNIQUE KEY uniq_bot_status_app_guild (app, guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_state (
  state_key VARCHAR(100) PRIMARY KEY,
  state_value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat-platform guild snapshots (app-scoped: "discord" today, other chat platforms possible later)
CREATE TABLE IF NOT EXISTS guild_info (
  app VARCHAR(20) NOT NULL,
  guild_id VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon_url VARCHAR(500) NULL,
  description VARCHAR(500) NULL,
  owner_id VARCHAR(64) NULL,
  boost_tier INT NULL,
  boost_count INT NULL,
  verification_level VARCHAR(20) NULL,
  preferred_locale VARCHAR(10) NULL,
  guild_created_at TIMESTAMP NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (app, guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guild_channels (
  app VARCHAR(20) NOT NULL,
  id VARCHAR(64) NOT NULL,
  guild_id VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(30) NULL,
  position INT NULL,
  parent_id VARCHAR(64) NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (app, id),
  KEY idx_guild_channels_guild (app, guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guild_roles (
  app VARCHAR(20) NOT NULL,
  id VARCHAR(64) NOT NULL,
  guild_id VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NULL,
  position INT NULL,
  mentionable TINYINT(1) NULL,
  hoisted TINYINT(1) NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (app, id),
  KEY idx_guild_roles_guild (app, guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-(app, guild_id) configuration/feature-flags; each server gets its own fully
-- independent set, superseding the single global `configurations` table above.
CREATE TABLE IF NOT EXISTS guild_config (
  app VARCHAR(20) NOT NULL,
  guild_id VARCHAR(64) NOT NULL,
  config VARCHAR(255) NOT NULL,
  value VARCHAR(255) NULL,
  PRIMARY KEY (app, guild_id, config)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-(app, guild_id, platform_user_id) server membership: Discord handle/nickname/roles/
-- joined-at held in that server. chat_member_mapping stays the single global cross-server
-- identity; the link to it lives in member_aliases (one identity, many guild_member aliases),
-- not here, and is never set by sync — linking is a manual admin action (future work).
CREATE TABLE IF NOT EXISTS guild_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app VARCHAR(20) NOT NULL,
  guild_id VARCHAR(64) NOT NULL,
  platform_user_id VARCHAR(64) NOT NULL,
  handle VARCHAR(255) NULL,
  nickname VARCHAR(255) NULL,
  roles TEXT NULL,
  joined_at DATETIME NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_guild_members_app_guild_platform (app, guild_id, platform_user_id),
  KEY idx_guild_members_app_guild (app, guild_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Links one chat_member_mapping identity to many guild_members rows (one-to-many). A
-- guild_member row is "unlinked" until an admin creates this row (see GET
-- /api/guild-members/unlinked) — sync never creates or touches this table.
CREATE TABLE IF NOT EXISTS member_aliases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_member_mapping_id INT NOT NULL,
  guild_member_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_member_aliases_guild_member (guild_member_id),
  KEY idx_member_aliases_chat_member (chat_member_mapping_id),
  CONSTRAINT fk_member_aliases_chat_member FOREIGN KEY (chat_member_mapping_id) REFERENCES chat_member_mapping(id) ON DELETE CASCADE,
  CONSTRAINT fk_member_aliases_guild_member FOREIGN KEY (guild_member_id) REFERENCES guild_members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin-defined usage-stat thresholds. `type` is the fine-grained metric key (see
-- webapi/services/milestoneTypes.js), `item` scopes it to one entity (null = global), `object`
-- is a free-form display category, not used for matching.
CREATE TABLE IF NOT EXISTS milestones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quantity INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  item VARCHAR(255) NULL,
  message VARCHAR(1000) NOT NULL,
  object VARCHAR(50) NOT NULL,
  achieved TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_milestones_lookup (type, item, achieved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vote-to-timeout: mutable ledger, one row per active vote (deleted on reaction-remove).
CREATE TABLE IF NOT EXISTS timeout_vote_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app VARCHAR(20) NOT NULL,
  guild_id VARCHAR(64) NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  target INT NULL,
  voter INT NULL,
  weight INT NOT NULL DEFAULT 1,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_timeout_vote (message_id, voter),
  CONSTRAINT fk_timeout_vote_target FOREIGN KEY (target) REFERENCES chat_member_mapping(id) ON DELETE SET NULL,
  CONSTRAINT fk_timeout_vote_voter FOREIGN KEY (voter) REFERENCES chat_member_mapping(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vote-to-timeout: immutable record of fired timeouts. UNIQUE(message_id) is the idempotency
-- guard — once a row exists here, further votes on that message never re-trigger.
CREATE TABLE IF NOT EXISTS timeout_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app VARCHAR(20) NOT NULL,
  guild_id VARCHAR(64) NOT NULL,
  message_id VARCHAR(255) NOT NULL UNIQUE,
  target INT NULL,
  vote_weight_total INT NOT NULL,
  duration_seconds INT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_timeout_history_target FOREIGN KEY (target) REFERENCES chat_member_mapping(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
