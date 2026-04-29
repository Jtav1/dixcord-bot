import * as api from "./client.js";

/**
 * @param {{
 *   discord_user_id: string,
 *   discord_channel_id: string,
 *   discord_guild_id?: string | null,
 *   message_body: string,
 *   scheduled_at: Date | string,
 * }} payload
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function createScheduledMessage(payload) {
  const scheduled_at =
    payload.scheduled_at instanceof Date
      ? payload.scheduled_at.toISOString()
      : payload.scheduled_at;
  return api.post("/api/scheduled-messages", {
    discord_user_id: payload.discord_user_id,
    discord_channel_id: payload.discord_channel_id,
    discord_guild_id: payload.discord_guild_id ?? null,
    message_body: payload.message_body,
    scheduled_at,
  });
}

/**
 * @param {string} discord_user_id
 * @param {string} [status]
 */
export function listScheduledMessages(discord_user_id, status = "pending") {
  return api.get("/api/scheduled-messages", {
    params: { discord_user_id, status },
  });
}

/**
 * @param {number} [limit]
 */
export function getDueScheduledMessages(limit = 20) {
  return api.get("/api/scheduled-messages/due", {
    params: { limit },
  });
}

/**
 * Marks a scheduled message as sent in the API. Body must not use status "sent"
 * (server rejects that value and applies sent in the DB).
 * @param {number} id
 */
export function markScheduledMessageSent(id) {
  return api.put(`/api/scheduled-messages/${id}`, {});
}

/**
 * @param {number} id
 * @param {string} discord_user_id
 */
export function deleteScheduledMessage(id, discord_user_id) {
  return api.del(`/api/scheduled-messages/${id}`, {
    params: { discord_user_id },
  });
}
