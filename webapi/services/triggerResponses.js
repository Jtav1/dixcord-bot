/**
 * Trigger-response pairs: trigger strings map to response strings.
 * CRUD and get random response by trigger. Uses config/db.js (mysql or sqlite).
 */

import db from "../config/db.js";

/**
 * @returns {Promise<Array<{ id: number, trigger_string: string, response_string: string, created_at: string }>>}
 */
export async function getAll() {
  const [rows] = await db.query(
    "SELECT id, trigger_string, response_string, created_at FROM trigger_responses ORDER BY trigger_string, id"
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {number} id
 * @returns {Promise<{ id: number, trigger_string: string, response_string: string, created_at: string }|null>}
 */
export async function getById(id) {
  const [rows] = await db.query(
    "SELECT id, trigger_string, response_string, created_at FROM trigger_responses WHERE id = ?",
    [id]
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Unique trigger strings (for bot to match against message content).
 * @returns {Promise<string[]>}
 */
export async function getTriggerList() {
  const [rows] = await db.query(
    "SELECT DISTINCT trigger_string FROM trigger_responses ORDER BY trigger_string"
  );
  return Array.isArray(rows) ? rows.map((r) => r.trigger_string) : [];
}

/**
 * One random response for the given trigger string, or null if none exist.
 * @param {string} trigger
 * @returns {Promise<{ id: number, response_string: string }|null>}
 */
export async function getRandomResponse(trigger) {
  if (!trigger || typeof trigger !== "string" || !trigger.trim()) return null;
  const orderBy =
    (process.env.DB_TYPE || "mysql").toLowerCase() === "sqlite"
      ? "RANDOM()"
      : "RAND()";
  const [rows] = await db.query(
    `SELECT id, response_string FROM trigger_responses WHERE trigger_string = ? ORDER BY ${orderBy} LIMIT 1`,
    [trigger.trim()]
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * @param {string} trigger_string
 * @param {string} response_string
 * @returns {Promise<number|null>} Insert id
 */
export async function create(trigger_string, response_string) {
  const [result] = await db.query(
    "INSERT INTO trigger_responses (trigger_string, response_string) VALUES (?, ?)",
    [trigger_string.trim(), response_string.trim()]
  );
  return result?.insertId ?? result?.lastInsertRowid ?? null;
}

/**
 * @param {number} id
 * @param {{ trigger_string?: string, response_string?: string }} updates
 * @returns {Promise<boolean>}
 */
export async function update(id, { trigger_string, response_string }) {
  const updates = [];
  const values = [];
  if (trigger_string !== undefined) {
    updates.push("trigger_string = ?");
    values.push(typeof trigger_string === "string" ? trigger_string.trim() : trigger_string);
  }
  if (response_string !== undefined) {
    updates.push("response_string = ?");
    values.push(typeof response_string === "string" ? response_string.trim() : response_string);
  }
  if (updates.length === 0) return false;
  values.push(id);
  const [result] = await db.query(
    `UPDATE trigger_responses SET ${updates.join(", ")} WHERE id = ?`,
    values
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function remove(id) {
  const [result] = await db.query(
    "DELETE FROM trigger_responses WHERE id = ?",
    [id]
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
