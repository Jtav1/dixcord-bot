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

-- Posts (first example resource)
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS posts_updated_at
  AFTER UPDATE ON posts WHEN OLD.updated_at = NEW.updated_at
  BEGIN
    UPDATE posts SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

-- Tasks (second example resource)
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS tasks_updated_at
  AFTER UPDATE ON tasks WHEN OLD.updated_at = NEW.updated_at
  BEGIN
    UPDATE tasks SET updated_at = datetime('now') WHERE id = NEW.id;
  END;

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);

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
