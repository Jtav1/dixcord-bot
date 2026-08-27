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
