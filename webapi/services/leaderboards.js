/**
 * Leaderboard / stats queries. Mirrors data used by Discord commands:
 * plusplus-leaderboard, plusplus-total, plusplus-voter-frequency, plusplus-top-voters,
 * top-emojis, top-reposters, reposts-by-user.
 * Uses webapi config/db.js (MySQL or SQLite).
 */

import db from "../config/db.js";

/**
 * Normalize limit from API request (number or string). Clamps to [1, max].
 * @param {number|string} value
 * @param {number} [defaultN=5]
 * @param {number} [max=50]
 * @returns {number}
 */
export function parseLimit(value, defaultN = 5, max = 50) {
  const n = value == null ? defaultN : parseInt(value, 10);
  return Math.min(Math.max(1, Number.isNaN(n) ? defaultN : n), max);
}

// --- Plusplus (plusplus_tracking) ---

/**
 * @param {number} [limit]
 * @returns {Promise<Array<{ string, typestr, total }>>}
 */
export async function getPlusPlusTopScores(limit) {
  const n = parseLimit(limit, 5, 50);
  const [rows] = await db.query(
    "SELECT string, MAX(type) AS typestr, SUM(value) AS total FROM plusplus_tracking GROUP BY string ORDER BY total DESC LIMIT ?",
    [n],
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {number} [limit]
 * @returns {Promise<Array<{ string, typestr, total }>>}
 */
export async function getPlusPlusBottomScores(limit) {
  const n = parseLimit(limit, 5, 50);
  const [rows] = await db.query(
    "SELECT string, MAX(type) AS typestr, SUM(value) AS total FROM plusplus_tracking GROUP BY string ORDER BY total ASC LIMIT ?",
    [n],
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {string} string
 * @param {string} [type='word']
 * @returns {Promise<{ string, type, total }|null>}
 */
export async function getPlusPlusTotalByString(string, type = "word") {
  if (!string || (type !== "word" && type !== "user")) return null;
  const [rows] = await db.query(
    "SELECT SUM(value) AS total FROM plusplus_tracking WHERE string = ? AND type = ?",
    [String(string), type],
  );
  const total = rows?.[0]?.total ?? 0;
  return { string, type, total: total == null ? 0 : Number(total) };
}

/**
 * @param {string} voterId
 * @returns {Promise<{ voterId: string, total: number }|null>}
 */
export async function getPlusPlusVotesByVoter(voterId) {
  if (!voterId) return null;
  const [rows] = await db.query(
    "SELECT COUNT(*) AS total FROM plusplus_tracking WHERE voter = ?",
    [String(voterId)],
  );
  const total = rows?.[0]?.total ?? 0;
  return { voterId: String(voterId), total: Number(total) };
}

/**
 * @param {number} [limit]
 * @returns {Promise<Array<{ voter, total }>>}
 */
export async function getPlusPlusTopVoters(limit) {
  const n = parseLimit(limit, 3, 50);
  const [rows] = await db.query(
    "SELECT voter, COUNT(*) AS total FROM plusplus_tracking GROUP BY voter ORDER BY total DESC LIMIT ?",
    [n],
  );
  return Array.isArray(rows) ? rows : [];
}

// --- Emoji (emoji_frequency) ---

/**
 * @param {number} [limit]
 * @returns {Promise<Array<{ emoji, frequency, emoid, animated }>>}
 */
export async function getTopEmoji(limit) {
  const n = parseLimit(limit, 5, 50);
  const [rows] = await db.query(
    "SELECT emoji, frequency, emoid, animated FROM emoji_frequency ORDER BY frequency DESC LIMIT ?",
    [n],
  );
  return Array.isArray(rows) ? rows : [];
}

// --- Repost (user_repost_tracking) ---

/**
 * @param {number} [limit]
 * @returns {Promise<Array<{ userid, count }>>}
 */
export async function getTopReposters(limit) {
  const n = parseLimit(limit, 5, 50);
  const [rows] = await db.query(
    "SELECT userid, COUNT(*) AS count FROM user_repost_tracking GROUP BY userid ORDER BY count DESC LIMIT ?",
    [n],
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {string} userId
 * @returns {Promise<{ userId: string, count: number }|null>}
 */
export async function getRepostsForUser(userId) {
  if (!userId) return null;
  const [rows] = await db.query(
    "SELECT COUNT(*) AS count FROM user_repost_tracking WHERE userid = ?",
    [String(userId)],
  );
  const count = rows?.[0]?.count ?? 0;
  return { userId: String(userId), count: Number(count) };
}
