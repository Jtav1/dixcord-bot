import * as api from "../api/client.js";

/**
 * Check whether a message was already logged as pinned.
 * POST /api/message-processing/pin-check with { messageId }.
 * @param {string} msgid - Message ID
 * @returns {Promise<boolean>}
 */
export const isMessageAlreadyPinned = async (msgid) => {
  if (!msgid) return false;
  const { data } = await api.post("/api/message-processing/pin-check", {
    messageId: msgid,
  });
  return Boolean(data?.alreadyPinned);
};

/**
 * Log a message as pinned (idempotent; API no-op if already logged).
 * POST /api/message-processing/pin-log with { messageId }.
 * @param {string} msgid - Message ID
 * @returns {Promise<void>}
 */
export const logPinnedMessage = async (msgid) => {
  if (!msgid) return;
  await api.post("/api/message-processing/pin-log", { messageId: msgid });
};
