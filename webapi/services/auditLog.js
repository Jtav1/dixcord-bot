/**
 * Audit log for admin mutations. Uses config/db.js (mysql or sqlite).
 */

import db from "../config/db.js";

/**
 * Record an audit log entry.
 * @param {number} userId - users.id of actor
 * @param {string} action - e.g. create, update, delete
 * @param {string} resource - table or resource name
 * @param {number|string|null} resourceId
 * @param {object} [details]
 * @returns {Promise<void>}
 */
export async function recordAudit(userId, action, resource, resourceId, details = {}) {
  try {
    const detailsJson = JSON.stringify(details ?? {});
    await db.query(
      "INSERT INTO audit_log (user_id, action, resource, resource_id, details) VALUES (?, ?, ?, ?, ?)",
      [userId, action, resource, resourceId == null ? null : String(resourceId), detailsJson],
    );
  } catch (err) {
    console.error("recordAudit error:", err);
  }
}

/**
 * List audit log entries with pagination.
 * @param {{ limit?: number, offset?: number }} opts
 * @returns {Promise<{ entries: Array<object>, total: number }>}
 */
export async function listAuditLog(opts = {}) {
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const offset = Math.max(0, opts.offset ?? 0);

  const [countRows] = await db.query("SELECT COUNT(*) AS total FROM audit_log");
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(
    `SELECT al.id, al.user_id, u.email AS user_email, al.action, al.resource,
            al.resource_id, al.details, al.created_at
     FROM audit_log al
     LEFT JOIN users u ON al.user_id = u.id
     ORDER BY al.id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  const entries = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    user_email: row.user_email ?? null,
    action: String(row.action),
    resource: String(row.resource),
    resource_id: row.resource_id,
    details: parseDetails(row.details),
    created_at: row.created_at,
  }));

  return { entries, total };
}

/**
 * @param {unknown} raw
 * @returns {object}
 */
function parseDetails(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return { raw: String(raw) };
  }
}
