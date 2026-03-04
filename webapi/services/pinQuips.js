/**
 * Pin quips: messages the bot says when pinning. CRUD + random pick.
 * Uses config/db.js (mysql or sqlite).
 */

import db from "../config/db.js";

/**
 * @returns {Promise<Array<{ id: number, quip: string, created_at: string }>>}
 */
export async function getAll() {
  const [rows] = await db.query(
    "SELECT id, quip, created_at FROM pin_quips ORDER BY id"
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {number} id
 * @returns {Promise<{ id: number, quip: string, created_at: string }|null>}
 */
export async function getById(id) {
  const [rows] = await db.query(
    "SELECT id, quip, created_at FROM pin_quips WHERE id = ?",
    [id]
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Return one random pin quip, or null if none exist.
 * @returns {Promise<{ id: number, quip: string }|null>}
 */
export async function getRandom() {
  const orderBy =
    (process.env.DB_TYPE || "mysql").toLowerCase() === "sqlite"
      ? "RANDOM()"
      : "RAND()";
  const [rows] = await db.query(
    `SELECT id, quip FROM pin_quips ORDER BY ${orderBy} LIMIT 1`
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * @param {string} quip
 * @returns {Promise<number|null>} Insert id
 */
export async function create(quip) {
  const [result] = await db.query(
    "INSERT INTO pin_quips (quip) VALUES (?)",
    [quip]
  );
  return result?.insertId ?? result?.lastInsertRowid ?? null;
}

/**
 * @param {number} id
 * @param {{ quip?: string }} updates
 * @returns {Promise<boolean>}
 */
export async function update(id, { quip }) {
  if (quip === undefined) return false;
  const [result] = await db.query(
    "UPDATE pin_quips SET quip = ? WHERE id = ?",
    [quip, id]
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function remove(id) {
  const [result] = await db.query("DELETE FROM pin_quips WHERE id = ?", [id]);
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
