import * as api from "./client.js";
import { guildId } from "../configVars.js";

/**
 * Record emoji usage. POST /api/message-processing/emoji-count
 * guildId (this bot's own, from configVars) is required so webapi can resolve this server's
 * plusplus_emoji/minusminus_emoji from guild_config for the reply-vote comparison.
 * @param {string} emojiName - Emoji name
 * @param {string} [emojiId] - Emoji ID (optional for unicode)
 * @param {string|null} [userid] - User who used the emoji (author/reactor)
 * @returns {Promise<Array>} milestones newly achieved by this count, if any
 */
export const countEmoji = async (emojiName, emojiId, userid = null) => {
  const authorId = userid || undefined;
  const emojis = [{ name: emojiName, id: emojiId ?? undefined }].filter(
    (e) => e.name != null && e.name !== "",
  );
  if (emojis.length === 0) return [];
  const { data } = await api.post("/api/message-processing/emoji-count", {
    app: "fluxer",
    guildId,
    authorId,
    emojis,
  });
  return Array.isArray(data?.milestones) ? data.milestones : [];
};
