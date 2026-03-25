/**
 * MySQL database setup for dixcord-bot: initialization + default data import.
 * Combines former initialize.js and import.js. Creates all tables, seeds pin_quips,
 * configurations, and link_replacements.
 *
 * Run: npm run db:setup:mysql  or  npm run db:migrate:mysql
 * Requires: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in .env
 */
import "dotenv/config";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "api_template",
  waitForConnections: true,
  connectionLimit: 5,
});

const execQuery = async (query, params = []) => {
  try {
    const [rows] = await pool.query(query, params);
    return rows;
  } catch (err) {
    console.error("db: query error", err.message);
    if (params.length === 0) console.error(query);
    throw err;
  }
};

const initializeDatabase = async () => {
  // Users (for authentication and profile)
  await execQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Discord user display/cache (snowflake -> stable id for FKs elsewhere)
  await execQuery(`
    CREATE TABLE IF NOT EXISTS chat_member_mapping (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      discord_handle VARCHAR(255) NOT NULL UNIQUE,
      discord_id VARCHAR(255) NOT NULL UNIQUE
    )
  `);

  // Configuration table
  await execQuery(`
    CREATE TABLE IF NOT EXISTS configurations (
      config VARCHAR(255) PRIMARY KEY,
      value VARCHAR(255)
    )
  `);

  // Emoji tracking table
  await execQuery(`
    CREATE TABLE IF NOT EXISTS emoji_frequency (
      emoid VARCHAR(255) NOT NULL,
      emoji VARCHAR(255) NOT NULL,
      frequency INT NOT NULL DEFAULT 0,
      animated BOOLEAN,
      type VARCHAR(50),
      PRIMARY KEY (emoid)
    )
  `);

  // Sticker tracking table (no animated column)
  await execQuery(`
    CREATE TABLE IF NOT EXISTS sticker_frequency (
      stickerid VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      frequency INT NOT NULL DEFAULT 0,
      PRIMARY KEY (stickerid)
    )
  `);

  // Pinned message table
  await execQuery(`
    CREATE TABLE IF NOT EXISTS pin_history (
      msgid VARCHAR(255) PRIMARY KEY,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Fortune (eight ball) responses table
  await execQuery(`
    CREATE TABLE IF NOT EXISTS eight_ball_responses (
      id INT PRIMARY KEY AUTO_INCREMENT,
      response_string VARCHAR(500) NOT NULL,
      sentiment ENUM('positive', 'negative', 'neutral') NOT NULL,
      frequency INT DEFAULT 0,
      UNIQUE KEY unique_response (response_string, sentiment)
    )
  `);

  // User emoji tracking table
  await execQuery(`
    CREATE TABLE IF NOT EXISTS user_emoji_tracking (
      id INT PRIMARY KEY AUTO_INCREMENT,
      userid VARCHAR(500) NOT NULL,
      emoid VARCHAR(255) NOT NULL,
      frequency INT DEFAULT 1,
      CONSTRAINT unique_user_emoji UNIQUE (userid, emoid),
      FOREIGN KEY (emoid) REFERENCES emoji_frequency(emoid)
    )
  `);

  // Repost tracking table
  await execQuery(`
    CREATE TABLE IF NOT EXISTS user_repost_tracking (
      id INT PRIMARY KEY AUTO_INCREMENT,
      userid VARCHAR(500) NOT NULL,
      msgid VARCHAR(500) NOT NULL,
      accuser VARCHAR(500) NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      msgcontents TEXT,
      CONSTRAINT unique_repost_accusation UNIQUE (userid, msgid, accuser)
    )
  `);

  // Migration: add msgcontents if table existed before this column was added
  try {
    const [cols] = await pool.query(
      "SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_repost_tracking' AND COLUMN_NAME = 'msgcontents'",
    );
    if (cols && cols[0]?.c === 0) {
      await execQuery(
        "ALTER TABLE user_repost_tracking ADD COLUMN msgcontents TEXT",
      );
    }
  } catch (_) {}

  // PlusPlus tracking table
  await execQuery(`
    CREATE TABLE IF NOT EXISTS plusplus_tracking (
      id INT PRIMARY KEY AUTO_INCREMENT,
      type VARCHAR(10) NOT NULL,
      string VARCHAR(500) DEFAULT NULL,
      voter VARCHAR(500) DEFAULT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      value VARCHAR(500) DEFAULT NULL
    )
  `);

  // Link replacements (twitter/social fixer: source host -> target host)
  await execQuery(`
    CREATE TABLE IF NOT EXISTS link_replacements (
      id INT PRIMARY KEY AUTO_INCREMENT,
      source_host VARCHAR(255) NOT NULL UNIQUE,
      target_host VARCHAR(255) NOT NULL
    )
  `);

  // Pin quips (messages said when bot pins a message)
  await execQuery(`
    CREATE TABLE IF NOT EXISTS pin_quips (
      id INT PRIMARY KEY AUTO_INCREMENT,
      quip VARCHAR(500) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Trigger-response: triggers, responses, junction, round-robin state
  await execQuery(`
    CREATE TABLE IF NOT EXISTS triggers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      trigger_string VARCHAR(255) NOT NULL UNIQUE,
      selection_mode VARCHAR(10) NOT NULL DEFAULT 'random',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      frequency INT DEFAULT 0
    )
  `);
  await execQuery(`
    CREATE TABLE IF NOT EXISTS responses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      response_string VARCHAR(500) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      frequency INT DEFAULT 0
    )
  `);
  await execQuery(`
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
    )
  `);
  await execQuery(`
    CREATE TABLE IF NOT EXISTS trigger_response_state (
      trigger_id INT PRIMARY KEY,
      last_used_response_order INT NULL,
      FOREIGN KEY (trigger_id) REFERENCES triggers(id) ON DELETE CASCADE
    )
  `);

  await execQuery(`
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
    )
  `);

  const defaultPinQuips = [
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
  const [pinQuipRows] = await pool.query(
    "SELECT COUNT(*) as count FROM pin_quips",
  );
  const pinQuipsCount = pinQuipRows?.[0]?.count ?? 0;
  if (pinQuipsCount === 0) {
    for (const quip of defaultPinQuips) {
      await pool.query("INSERT INTO pin_quips (quip) VALUES (?)", [quip]);
    }
    console.log("db: MySQL pin_quips seed complete");
  }

  console.log("db: MySQL table initialization complete");
};

const importConfigs = async () => {
  const isDev = process.env.NODE_ENV !== "production";
  const delay = Math.floor(Math.random() * 60000 + 60000);
  const pinThreshold = isDev ? 1 : 3;
  const pinChannelId = isDev ? "710671234471559228" : "915462110761349201";
  const announceChannelId = isDev ? "710671234471559228" : "911427650730487878";

  const configArray = [
    ["rare_frequency", "0.1"],
    ["twitter_fix_enabled", "true"],
    ["pin_threshold", String(pinThreshold)],
    ["pin_emoji", "\ud83d\udccc"],
    ["repost_emoji", "1072368151922233404"],
    ["announce_channel_id", announceChannelId],
    ["take_a_look_delay", String(delay)],
    ["take_a_look_repost_limit", "2"],
    ["pin_channel_id", pinChannelId],
    ["plusplus_emoji", "1333222614033760326"],
    ["minusminus_emoji", "1333222612683194442"],
    ["timeout_emoji", null],
    ["timeout_vote_threshold", "5"],
  ];

  const placeholders = configArray.map(() => "(?, ?)").join(", ");
  const values = configArray.flat();

  await execQuery(
    `INSERT IGNORE INTO configurations (config, value) VALUES ${placeholders}`,
    values,
  );

  console.log("db: MySQL configuration import complete");
};

const defaultLinkReplacements = [
  ["x.com", "fixvx.com"],
  ["twitter.com", "fixvx.com"],
  ["instagram.com", "jgram.jtav.me"],
  ["tiktok.com", "kktiktok.com"],
  ["bsky.app", "bskx.app"],
];

const importLinkReplacements = async () => {
  for (const [source_host, target_host] of defaultLinkReplacements) {
    await execQuery(
      `INSERT IGNORE INTO link_replacements (source_host, target_host) VALUES (?, ?)`,
      [source_host, target_host],
    );
  }
  console.log("db: MySQL link_replacements import complete");
};

const importUsers = async () => {
  // user_lookup table removed in v2.0; no-op for backward compatibility with run()
  console.log("db: user_lookup no longer used (v2.0)");
};

const run = async () => {
  try {
    await initializeDatabase();
    await importConfigs();
    await importLinkReplacements();
    // await importUsers();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(err);
    await pool.end();
    process.exit(1);
  }
};

run();
