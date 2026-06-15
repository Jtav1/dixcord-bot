/**
 * Pin history read access for admin audit.
 */

import db from "../config/db.js";

/**
 * List pin history entries with pagination.
 * @param {{ limit?: number, offset?: number }} opts
 * @returns {Promise<{ entries: Array<{ msgid: string, timestamp: string }>, total: number }>}
 */
export async function listPinHistory(opts = {}) {
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const offset = Math.max(0, opts.offset ?? 0);

  const [countRows] = await db.query("SELECT COUNT(*) AS total FROM pin_history");
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(
    "SELECT msgid, timestamp FROM pin_history ORDER BY timestamp DESC LIMIT ? OFFSET ?",
    [limit, offset],
  );

  const entries = (Array.isArray(rows) ? rows : []).map((row) => ({
    msgid: String(row.msgid),
    timestamp: row.timestamp,
  }));

  return { entries, total };
}
