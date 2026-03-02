/**
 * MySQL default data import for dixcord-bot.
 * Mirrors database/import.js from the main bot.
 *
 * Run from webapi dir: node scripts/mysql/import.js
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

const execQuery = async (query, params = []) => {
  try {
    const [rows] = await pool.query(query, params);
    return rows;
  } catch (err) {
    console.error('db: query error', err.message);
    throw err;
  }
};

const isDev = process.env.NODE_ENV !== 'production';

export const importConfigs = async () => {
  const delay = Math.floor(Math.random() * 60000 + 60000);
  const pinThreshold = isDev ? 1 : 3;
  const pinChannelId = isDev ? '710671234471559228' : '915462110761349201';
  const announceChannelId = isDev ? '710671234471559228' : '911427650730487878';

  const configArray = [
    ['rare_frequency', '0.1'],
    ['twitter_fix_enabled', 'true'],
    ['pin_threshold', String(pinThreshold)],
    ['pin_emoji', '\ud83d\udccc'],
    ['repost_emoji', '1072368151922233404'],
    ['announce_channel_id', announceChannelId],
    ['take_a_look_delay', String(delay)],
    ['take_a_look_repost_limit', '2'],
    ['pin_channel_id', pinChannelId],
    ['plusplus_emoji', '1333222614033760326'],
    ['minusminus_emoji', '1333222612683194442'],
    ['timeout_emoji', null],
    ['timeout_vote_threshold', '5'],
  ];

  const placeholders = configArray.map(() => '(?, ?)').join(', ');
  const values = configArray.flat();

  await execQuery(
    `INSERT IGNORE INTO configurations (config, value) VALUES ${placeholders}`,
    values
  );

  console.log('db: MySQL configuration import complete');
};

const defaultLinkReplacements = [
  ['x.com', 'fixvx.com'],
  ['twitter.com', 'fixvx.com'],
  ['instagram.com', 'jgram.jtav.me'],
  ['tiktok.com', 'vxtiktok.com'],
  ['bsky.app', 'bskx.app'],
];

export const importLinkReplacements = async () => {
  for (const [source_host, target_host] of defaultLinkReplacements) {
    await execQuery(
      `INSERT IGNORE INTO link_replacements (source_host, target_host) VALUES (?, ?)`,
      [source_host, target_host]
    );
  }
  console.log('db: MySQL link_replacements import complete');
};

export const importUsers = async () => {
  const userAry = [];
  if (userAry.length === 0) {
    console.log('db: no users to import (placeholder)');
    return;
  }
  const placeholders = userAry.map(() => '(?, ?, ?)').join(', ');
  const values = userAry.flat();
  await execQuery(
    `INSERT INTO user_lookup (userid, username, handle) VALUES ${placeholders} ON DUPLICATE KEY UPDATE handle = VALUES(handle)`,
    values
  );
  console.log('db: MySQL user import complete');
};

export const importAll = async () => {
  await importConfigs();
  await importLinkReplacements();
  // await importUsers();
};

const run = async () => {
  try {
    await importAll();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(err);
    await pool.end();
    process.exit(1);
  }
};

run();
