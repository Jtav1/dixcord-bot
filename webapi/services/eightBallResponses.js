/**
 * Eight-ball (fortune) response CRUD. Uses config/db.js (mysql or sqlite).
 */

import db from "../config/db.js";

const VALID_SENTIMENTS = new Set(["positive", "negative", "neutral"]);

/**
 * @returns {Promise<Array<{ id: number, response_string: string, sentiment: string, frequency: number }>>}
 */
export async function getAll() {
  const [rows] = await db.query(
    "SELECT id, response_string, sentiment, frequency FROM eight_ball_responses ORDER BY id",
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {number} id
 * @returns {Promise<{ id: number, response_string: string, sentiment: string, frequency: number }|null>}
 */
export async function getById(id) {
  const [rows] = await db.query(
    "SELECT id, response_string, sentiment, frequency FROM eight_ball_responses WHERE id = ?",
    [id],
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * @param {string} responseString
 * @param {string} sentiment
 * @returns {Promise<number|null>} Insert id
 */
export async function create(responseString, sentiment) {
  const sentimentNorm = String(sentiment).toLowerCase();
  if (!VALID_SENTIMENTS.has(sentimentNorm)) return null;
  const [result] = await db.query(
    "INSERT INTO eight_ball_responses (response_string, sentiment) VALUES (?, ?)",
    [responseString.trim(), sentimentNorm],
  );
  return result?.insertId ?? result?.lastInsertRowid ?? null;
}

/**
 * @param {number} id
 * @param {{ response_string?: string, sentiment?: string }} updates
 * @returns {Promise<boolean>}
 */
export async function update(id, updates) {
  const setParts = [];
  const values = [];

  if (updates.response_string !== undefined) {
    const text = String(updates.response_string).trim();
    if (!text) return false;
    setParts.push("response_string = ?");
    values.push(text);
  }
  if (updates.sentiment !== undefined) {
    const sentimentNorm = String(updates.sentiment).toLowerCase();
    if (!VALID_SENTIMENTS.has(sentimentNorm)) return false;
    setParts.push("sentiment = ?");
    values.push(sentimentNorm);
  }

  if (setParts.length === 0) return false;
  values.push(id);
  const [result] = await db.query(
    `UPDATE eight_ball_responses SET ${setParts.join(", ")} WHERE id = ?`,
    values,
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function remove(id) {
  const [result] = await db.query(
    "DELETE FROM eight_ball_responses WHERE id = ?",
    [id],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

export { VALID_SENTIMENTS };
