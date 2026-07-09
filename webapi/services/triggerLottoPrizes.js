/**
 * Catalog of lotto prize keys for lotto trigger selection.
 */

import db from "../config/db.js";

/**
 * List all lotto prize catalog rows ordered by id.
 * @returns {Promise<Array<{ id: number, prize_string: string, frequency: number }>>}
 */
export async function getAll() {
  const [rows] = await db.query(
    "SELECT id, prize_string, frequency FROM trigger_lotto_prizes ORDER BY id ASC",
  );
  return Array.isArray(rows)
    ? rows.map((row) => ({
        id: Number(row.id),
        prize_string: String(row.prize_string),
        frequency: Number(row.frequency ?? 0),
      }))
    : [];
}

/**
 * Increment frequency for a catalog prize when it is awarded.
 * @param {string} prizeString - prize_string value from trigger_response.lotto_prize
 * @returns {Promise<boolean>} true if a row was updated
 */
export async function incrementFrequency(prizeString) {
  if (!prizeString || typeof prizeString !== "string" || !prizeString.trim()) {
    return false;
  }
  const [result] = await db.query(
    "UPDATE trigger_lotto_prizes SET frequency = frequency + 1 WHERE prize_string = ?",
    [prizeString.trim()],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
