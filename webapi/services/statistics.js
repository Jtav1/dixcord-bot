/**
 * Aggregate database statistics for admin and web-view dashboards.
 */

import db from "../config/db.js";

/**
 * Coerce a database aggregate value to a non-negative integer.
 * @param {unknown} value Raw query result value.
 * @returns {number} Parsed count or sum.
 */
function toCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Query aggregate row counts and usage totals across core tracking tables.
 * @returns {Promise<{
 *   chatMemberMappings: number,
 *   emojiCatalog: { emojis: number, stickers: number, total: number },
 *   emojiUsage: { emojis: number, stickers: number, total: number },
 *   pinHistory: number,
 *   plusplusTracking: number,
 *   triggers: number,
 *   responses: number,
 *   triggerResponseFrequencySum: number,
 *   repostTracking: number
 * }>}
 */
export async function getDatabaseStatistics() {
  const [rows] = await db.query(
    `SELECT
      (SELECT COUNT(*) FROM chat_member_mapping) AS chat_member_mappings,
      (SELECT COUNT(*) FROM emoji_frequency WHERE type = 'emoji' OR type IS NULL) AS emoji_catalog_count,
      (SELECT COUNT(*) FROM emoji_frequency WHERE type = 'sticker') AS sticker_catalog_count,
      (SELECT COALESCE(SUM(frequency), 0) FROM emoji_frequency WHERE type = 'emoji' OR type IS NULL) AS emoji_usage_total,
      (SELECT COALESCE(SUM(frequency), 0) FROM emoji_frequency WHERE type = 'sticker') AS sticker_usage_total,
      (SELECT COUNT(*) FROM pin_history) AS pin_history_count,
      (SELECT COUNT(*) FROM plusplus_tracking) AS plusplus_tracking_count,
      (SELECT COUNT(*) FROM triggers) AS triggers_count,
      (SELECT COUNT(*) FROM responses) AS responses_count,
      (SELECT COALESCE(SUM(frequency), 0) FROM trigger_response) AS trigger_response_frequency_sum,
      (SELECT COUNT(*) FROM user_repost_tracking) AS repost_tracking_count`,
  );

  const row = rows?.[0] ?? {};

  const emojiCatalogEmojis = toCount(row.emoji_catalog_count);
  const emojiCatalogStickers = toCount(row.sticker_catalog_count);
  const emojiUsageEmojis = toCount(row.emoji_usage_total);
  const emojiUsageStickers = toCount(row.sticker_usage_total);

  return {
    chatMemberMappings: toCount(row.chat_member_mappings),
    emojiCatalog: {
      emojis: emojiCatalogEmojis,
      stickers: emojiCatalogStickers,
      total: emojiCatalogEmojis + emojiCatalogStickers,
    },
    emojiUsage: {
      emojis: emojiUsageEmojis,
      stickers: emojiUsageStickers,
      total: emojiUsageEmojis + emojiUsageStickers,
    },
    pinHistory: toCount(row.pin_history_count),
    plusplusTracking: toCount(row.plusplus_tracking_count),
    triggers: toCount(row.triggers_count),
    responses: toCount(row.responses_count),
    triggerResponseFrequencySum: toCount(row.trigger_response_frequency_sum),
    repostTracking: toCount(row.repost_tracking_count),
  };
}
