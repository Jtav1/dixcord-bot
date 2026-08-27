/**
 * trigger_response_user_history: one row per (user, trigger_response) usage, for audit/analytics.
 * Writes resolve the platform user id to chat_member_mapping.id via chatMemberMapping.js.
 */

import db from "../config/db.js";
import { getChatMemberMappingIdByPlatformUserId } from "./chatMemberMapping.js";

/**
 * Record that a user received a given trigger_response selection.
 * Resolves platformUserId (e.g. a Discord snowflake) to chat_member_mapping.id via app;
 * skips the write (returning ok: false) if the user isn't mapped yet, so an unmapped user
 * never blocks the bot's underlying reply.
 * @param {number} triggerResponseId - trigger_response junction row id that was selected
 * @param {unknown} platformUserId - platform user id of the recipient (e.g. Discord snowflake)
 * @param {string} app - chat app key, e.g. "discord"
 * @returns {Promise<{ ok: true, id: number } | { ok: false, error: string }>}
 */
export async function recordTriggerResponseUsage(
  triggerResponseId,
  platformUserId,
  app,
) {
  if (!Number.isFinite(triggerResponseId) || triggerResponseId <= 0) {
    return { ok: false, error: "Invalid trigger_response id" };
  }
  const userId = await getChatMemberMappingIdByPlatformUserId(
    platformUserId,
    app,
  );
  if (userId == null) {
    return { ok: false, error: "Unknown user; not in chat_member_mapping for this app." };
  }
  const [result] = await db.query(
    "INSERT INTO trigger_response_user_history (user_id, trigger_response_id) VALUES (?, ?)",
    [userId, triggerResponseId],
  );
  const id = result?.insertId ?? result?.lastInsertRowid ?? null;
  return { ok: true, id };
}

/**
 * List paginated trigger_response_user_history entries for one internal user (chat_member_mapping.id),
 * joined with the trigger/response text for display.
 * @param {number} userId - chat_member_mapping.id
 * @param {{ limit?: number, offset?: number }} [opts]
 * @returns {Promise<{ entries: Array<{ id: number, timestamp: string, triggerResponseId: number, triggerString: string, responseString: string }>, total: number }>}
 */
export async function listTriggerResponseHistoryForUser(userId, opts = {}) {
  if (!Number.isFinite(userId) || userId <= 0) return { entries: [], total: 0 };

  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const offset = Math.max(0, opts.offset ?? 0);

  const [countRows] = await db.query(
    "SELECT COUNT(*) AS total FROM trigger_response_user_history WHERE user_id = ?",
    [userId],
  );
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(
    `SELECT h.id, h.timestamp, h.trigger_response_id, t.trigger_string, r.response_string
     FROM trigger_response_user_history h
     JOIN trigger_response tr ON tr.id = h.trigger_response_id
     JOIN triggers t ON t.id = tr.trigger_id
     JOIN responses r ON r.id = tr.response_id
     WHERE h.user_id = ?
     ORDER BY h.timestamp DESC, h.id DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset],
  );

  const entries = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: Number(row.id),
    timestamp: row.timestamp,
    triggerResponseId: Number(row.trigger_response_id),
    triggerString: String(row.trigger_string),
    responseString: String(row.response_string),
  }));

  return { entries, total };
}
