/**
 * MySQL database initialization for dixcord-bot tables.
 * Mirrors database/initialize.js from the main bot.
 *
 * Run from webapi dir: node scripts/mysql/initialize.js
 * Requires: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in .env
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'api_template',
  waitForConnections: true,
  connectionLimit: 5,
});

const execQuery = async (query) => {
  try {
    const [rows] = await pool.query(query);
    return rows;
  } catch (err) {
    console.error('db: query error', err.message);
    console.error(query);
    throw err;
  }
};

export const initializeDatabase = async () => {
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
      frequency INT NOT NULL,
      animated BOOLEAN,
      type VARCHAR(50) NOT NULL,
      PRIMARY KEY (emoid)
    )
  `);

  // Pinned message table
  await execQuery(`
    CREATE TABLE IF NOT EXISTS pin_history (
      msgid VARCHAR(255) PRIMARY KEY,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Take a look responses table
  await execQuery(`
    CREATE TABLE IF NOT EXISTS take_a_look_responses (
      id INT PRIMARY KEY AUTO_INCREMENT,
      link VARCHAR(255) UNIQUE,
      isdefault SMALLINT DEFAULT 0,
      frequency INT DEFAULT 0
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

  // Log filter keywords table
  await execQuery(`
    CREATE TABLE IF NOT EXISTS log_filter_keywords (
      id INT PRIMARY KEY AUTO_INCREMENT,
      keyword VARCHAR(255) UNIQUE
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
      "SELECT COUNT(*) as c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_repost_tracking' AND COLUMN_NAME = 'msgcontents'"
    );
    if (cols && cols[0]?.c === 0) {
      await execQuery("ALTER TABLE user_repost_tracking ADD COLUMN msgcontents TEXT");
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

  // User lookup table
  await execQuery(`
    CREATE TABLE IF NOT EXISTS user_lookup (
      userid VARCHAR(255) NOT NULL,
      username VARCHAR(255) NOT NULL,
      handle VARCHAR(255) NOT NULL,
      PRIMARY KEY (userid, username)
    )
  `);

  console.log('db: MySQL table initialization complete');
};

const run = async () => {
  try {
    await initializeDatabase();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(err);
    await pool.end();
    process.exit(1);
  }
};

run();
