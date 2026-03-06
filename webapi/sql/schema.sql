

-- Users (for authentication and profile)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Bot response tables (shared with dixcord-bot when using same DB)
CREATE TABLE IF NOT EXISTS configurations (
  config VARCHAR(255) PRIMARY KEY,
  value VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS eight_ball_responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  response_string VARCHAR(500) NOT NULL,
  sentiment ENUM('positive', 'negative', 'neutral') NOT NULL,
  frequency INT DEFAULT 0,
  UNIQUE KEY unique_response (response_string, sentiment)
);

CREATE TABLE IF NOT EXISTS plusplus_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(10) NOT NULL,
  string VARCHAR(500) DEFAULT NULL,
  voter VARCHAR(500) DEFAULT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  value VARCHAR(500) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS emoji_frequency (
  emoid VARCHAR(255) PRIMARY KEY,
  emoji VARCHAR(255) NOT NULL,
  frequency INT NOT NULL DEFAULT 0,
  animated TINYINT(1) DEFAULT 0,
  type VARCHAR(50) DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS sticker_frequency (
  stickerid VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  frequency INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pin_history (
  msgid VARCHAR(255) PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_emoji_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userid VARCHAR(500) NOT NULL,
  emoid VARCHAR(255) NOT NULL,
  frequency INT DEFAULT 1,
  UNIQUE KEY unique_user_emoji (userid, emoid)
);

CREATE TABLE IF NOT EXISTS user_repost_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userid VARCHAR(500) NOT NULL,
  msgid VARCHAR(500) NOT NULL,
  accuser VARCHAR(500) NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  msgcontents TEXT DEFAULT NULL,
  UNIQUE KEY unique_repost_accusation (userid, msgid, accuser)
);

CREATE TABLE IF NOT EXISTS link_replacements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_host VARCHAR(255) NOT NULL UNIQUE,
  target_host VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS pin_quips (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quip VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Triggers: one row per unique trigger string (selection_mode for random vs ordered)
CREATE TABLE IF NOT EXISTS triggers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trigger_string VARCHAR(255) NOT NULL UNIQUE,
  selection_mode VARCHAR(10) NOT NULL DEFAULT 'random',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  frequency INT DEFAULT 0
);

-- Responses: reusable response strings (many-to-many with triggers via trigger_response)
CREATE TABLE IF NOT EXISTS responses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  response_string VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  frequency INT DEFAULT 0
);

-- Junction: which responses belong to which trigger, with optional order and weight (0-100 or null)
CREATE TABLE IF NOT EXISTS trigger_response (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trigger_id INT NOT NULL,
  response_id INT NOT NULL,
  response_order INT NULL,
  weight INT NULL DEFAULT NULL,
  frequency INT DEFAULT 0,
  FOREIGN KEY (trigger_id) REFERENCES triggers(id) ON DELETE CASCADE,
  FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
  UNIQUE KEY unique_trigger_response (trigger_id, response_id)
);

-- Round-robin state: last-used response id (responses.id) per trigger
CREATE TABLE IF NOT EXISTS trigger_response_state (
  trigger_string VARCHAR(255) PRIMARY KEY,
  last_used_response_id INT NULL
);
