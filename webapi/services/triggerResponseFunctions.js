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
 * @param {string} functionName - function_name value from trigger_response.response_function
 * @returns {Promise<boolean>} true if a row was updated
 */
export async function incrementFrequency(functionName) {
  if (!functionName || typeof functionName !== "string" || !functionName.trim()) {
    return false;
  }
  const [result] = await db.query(
    "UPDATE trigger_response_functions SET frequency = frequency + 1 WHERE function_name = ?",
    [functionName.trim()],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
