/**
 * Scheduled messages: CRUD and due query for bot polling.
 * Requester is stored as chat_member_mapping.id (`user_id`); platform ids are joined for responses.
 */

import db from "../config/db.js";

/**
 * @param {{
 *   user_id: number,
 *   discord_channel_id: string,
 *   discord_guild_id?: string | null,
 *   message_body: string,
 *   scheduled_at: string | Date,
 * }} row
 * @returns {Promise<number|null>} insert id
 */
export async function create(row) {
  const {
    user_id,
    discord_channel_id,
    discord_guild_id = null,
    message_body,
    scheduled_at,
  } = row;
  const at =
    scheduled_at instanceof Date
      ? scheduled_at.toISOString().slice(0, 19).replace("T", " ")
      : String(scheduled_at).trim();
  const [result] = await db.query(
    `INSERT INTO scheduled_messages (
      user_id, discord_channel_id, discord_guild_id, message_body, scheduled_at, status
    ) VALUES (?, ?, ?, ?, ?, 'pending')`,
    [
      user_id,
      String(discord_channel_id),
      discord_guild_id != null ? String(discord_guild_id) : null,
      String(message_body),
      at,
    ],
  );
  return result?.insertId ?? result?.lastInsertRowid ?? null;
}

const rowSelect = `
  sm.id, sm.user_id, cm.discord_id AS discord_user_id, sm.discord_channel_id, sm.discord_guild_id,
  sm.message_body, sm.scheduled_at, sm.status, sm.sent_at, sm.created_at
`;

/**
 * @param {number} user_id - chat_member_mapping.id
 * @param {string} [status]
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function listForUser(user_id, status = "pending") {
  const [rows] = await db.query(
    `SELECT ${rowSelect}
     FROM scheduled_messages sm
     INNER JOIN chat_member_mapping cm ON cm.id = sm.user_id
     WHERE sm.user_id = ? AND sm.status = ?
     ORDER BY sm.scheduled_at ASC`,
    [user_id, status],
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {Date|string} before
 * @param {number} limit
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function listDue(before, limit = 20) {
  const when =
    before instanceof Date
      ? before.toISOString().slice(0, 19).replace("T", " ")
      : String(before);
  const lim = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
  const [rows] = await db.query(
    `SELECT ${rowSelect}
     FROM scheduled_messages sm
     INNER JOIN chat_member_mapping cm ON cm.id = sm.user_id
     WHERE sm.status = 'pending' AND sm.scheduled_at <= ?
     ORDER BY sm.scheduled_at ASC
     LIMIT ?`,
    [when, lim],
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * @param {number} id
 * @returns {Promise<Record<string, unknown>|null>}
 */
export async function getById(id) {
  const [rows] = await db.query(
    `SELECT ${rowSelect}
     FROM scheduled_messages sm
     INNER JOIN chat_member_mapping cm ON cm.id = sm.user_id
     WHERE sm.id = ?`,
    [id],
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function markSent(id) {
  const [result] = await db.query(
    `UPDATE scheduled_messages
     SET status = 'sent', sent_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'pending'`,
    [id],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * Delete only if owned by user and still pending.
 * @param {number} id
 * @param {number} user_id - chat_member_mapping.id
 * @returns {Promise<boolean>}
 */
export async function removeIfOwnedPending(id, user_id) {
  const [result] = await db.query(
    `DELETE FROM scheduled_messages
     WHERE id = ? AND user_id = ? AND status = 'pending'`,
    [id, user_id],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
