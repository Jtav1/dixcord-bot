import * as api from "./client.js";

/**
 * Create a scheduled message for a requester.
 * @param {{ requesterUserId: string, chatChannelId: string, chatGuildId?: string|null, messageBody: string, scheduledAtUtcIso: string }} payload - Creation fields.
 * @returns {Promise<{ id: number, user_id: number, app: string, chat_channel_id: string, chat_guild_id: string|null, message_body: string, scheduled_at: string, status: string, sent_at: string|null, created_at: string|null }|null>} Created row or null.
 */
export async function createScheduledMessage(payload) {
  const { data } = await api.post("/api/scheduled-messages", {
    app: "discord",
    requesterUserId: payload.requesterUserId,
    chat_channel_id: payload.chatChannelId,
    chat_guild_id: payload.chatGuildId ?? null,
    message_body: payload.messageBody,
    scheduled_at: payload.scheduledAtUtcIso,
  });
  if (!data?.ok || !data?.scheduledMessage) return null;
  return data.scheduledMessage;
}

/**
 * Get upcoming unsent/future scheduled messages for one user.
 * @param {string} requesterUserId - Platform user id (discord user snowflake today).
 * @returns {Promise<Array<object>>} Scheduled message rows.
 */
export async function getUpcomingScheduledMessagesForUser(requesterUserId) {
  const { data } = await api.get("/api/scheduled-messages", {
    params: { app: "discord", requesterUserId },
  });
  if (!data?.ok || !Array.isArray(data.scheduledMessages)) return [];
  return data.scheduledMessages;
}

/**
 * Get one scheduled message by id for user ownership scope.
 * @param {{ id: number|string, requesterUserId: string }} payload - Lookup fields.
 * @returns {Promise<object|null>} Scheduled message row or null.
 */
export async function getScheduledMessageByIdForUser(payload) {
  const { data } = await api.get(`/api/scheduled-messages/${payload.id}`, {
    params: {
      app: "discord",
      requesterUserId: payload.requesterUserId,
    },
  });
  if (!data?.ok || !data?.scheduledMessage) return null;
  return data.scheduledMessage;
}

/**
 * Update a user-owned scheduled message.
 * @param {{ id: number|string, requesterUserId: string, messageContent?: string, scheduledAt?: string }} payload - Update fields.
 * @returns {Promise<object|null>} Updated scheduled row or null.
 */
export async function updateScheduledMessageForUser(payload) {
  const body = {
    app: "discord",
    requesterUserId: payload.requesterUserId,
  };

  if (payload.messageContent !== undefined && payload.messageContent.length > 0)
    body.message_body = payload.messageContent;
  if (
    payload.scheduledAt !== undefined &&
    String(payload.scheduledAt).length > 0
  ) {
    body.scheduled_at = payload.scheduledAt;
  }

  const { data } = await api.put(`/api/scheduled-messages/${payload.id}`, body);
  if (!data?.ok || !data?.scheduledMessage) return null;
  return data.scheduledMessage;
}

/**
 * Delete a user-owned pending scheduled message.
 * @param {{ id: number|string, requesterUserId: string }} payload - Delete fields.
 * @returns {Promise<boolean>} True when delete succeeds.
 */
export async function deleteScheduledMessageForUser(payload) {
  const { data } = await api.del(`/api/scheduled-messages/${payload.id}`, {
    params: {
      app: "discord",
      requesterUserId: payload.requesterUserId,
    },
  });
  return data?.ok === true;
}

/**
 * Bot scope: fetch all pending scheduled messages.
 * @returns {Promise<Array<object>>} Pending rows used for scheduler cache.
 */
export async function getPendingScheduledMessagesForBot() {
  const { data } = await api.get("/api/scheduled-messages", {
    params: { app: "discord", scope: "bot" },
  });
  if (!data?.ok || !Array.isArray(data.scheduledMessages)) return [];
  return data.scheduledMessages;
}

/**
 * Bot scope: mark one scheduled row as sent.
 * @param {{ id: number|string, sentAtUtcIso?: string }} payload - Mark-sent fields.
 * @returns {Promise<object|null>} Updated scheduled row or null.
 */
export async function markScheduledMessageSent(payload) {
  const { data } = await api.put(`/api/scheduled-messages/${payload.id}`, {
    app: "discord",
    scope: "bot",
    status: "sent",
    sent_at: payload.sentAtUtcIso ?? new Date().toISOString(),
  });
  if (!data?.ok || !data?.scheduledMessage) return null;
  return data.scheduledMessage;
}
