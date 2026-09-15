import { apiFetch } from "./http.js";

/**
 * Fetch aggregate database statistics from webapi.
 * @returns {Promise<{
 *   chatMemberMappings: number,
 *   emojiCatalog: { emojis: number, stickers: number, total: number },
 *   emojiUsage: { emojis: number, stickers: number, total: number },
 *   pinHistory: number,
 *   plusplusTracking: number,
 *   triggers: number,
 *   responses: number,
 *   triggerResponseFrequencySum: number,
 *   repostTracking: number,
 *   scheduledMessages: { pending: number, sent: number }
 * }>}
 */
export async function fetchStatistics() {
  const data = await apiFetch("/statistics", undefined, "Statistics");
  return data.statistics;
}
