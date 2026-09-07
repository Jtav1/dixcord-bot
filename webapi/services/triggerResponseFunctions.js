/**
 * Catalog of named functions a weighted trigger response can dispatch to.
 */

import db from "../config/db.js";

/**
 * List all trigger response function catalog rows ordered by id.
 * @returns {Promise<Array<{ id: number, function_name: string, frequency: number, display_name: string|null }>>}
 */
export async function getAll() {
  const [rows] = await db.query(
    "SELECT id, function_name, frequency, display_name FROM trigger_response_functions ORDER BY id ASC",
  );
  return Array.isArray(rows)
    ? rows.map((row) => ({
        id: Number(row.id),
        function_name: String(row.function_name),
        frequency: Number(row.frequency ?? 0),
        display_name: row.display_name == null ? null : String(row.display_name),
      }))
    : [];
}

/**
 * Increment frequency for a catalog function when it is invoked.
 * @param {number} id - trigger_response_functions.id (trigger_response.response_function FK value)
 * @returns {Promise<boolean>} true if a row was updated
 */
export async function incrementFrequencyById(id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return false;
  const [result] = await db.query(
    "UPDATE trigger_response_functions SET frequency = frequency + 1 WHERE id = ?",
    [n],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * Get or create a trigger_response_functions row by name, returning its id.
 * Dedupes by function_name, mirroring how triggers/responses are get-or-created by string.
 * @param {unknown} functionName
 * @returns {Promise<number|null>} null when functionName is empty/not a string
 */
export async function getOrCreateFunctionId(functionName) {
  const trimmed =
    typeof functionName === "string" ? functionName.trim() : "";
  if (!trimmed) return null;
  const [rows] = await db.query(
    "SELECT id FROM trigger_response_functions WHERE function_name = ?",
    [trimmed],
  );
  if (rows && rows.length > 0) return Number(rows[0].id);
  const [result] = await db.query(
    "INSERT INTO trigger_response_functions (function_name) VALUES (?)",
    [trimmed],
  );
  const id = result?.insertId ?? result?.lastInsertRowid ?? null;
  return id == null ? null : Number(id);
}
