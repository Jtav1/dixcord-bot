import * as api from "./client.js";
import { guildId } from "../configVars.js";

/**
 * Sync server emoji list with the web API. Fully replaces this guild's guild_emojis catalog.
 * POST /api/message-processing/emoji-import
 * @param {Array<import('@fluxerjs/core').GuildEmoji>} emojiList - e.g. from guild.fetchEmojis()
 */
export const importEmojiList = async (emojiList) => {
  const emojis = emojiList.map((e) => ({
    id: String(e.id),
    name: String(e.name),
    animated: Boolean(e.animated),
    available: null,
    managed: null,
    requiresColons: null,
    roles: [],
    type: "emoji",
  }));
  await api.post("/api/message-processing/emoji-import", { app: "fluxer", guildId, emojis });
  console.log("bot: emoji import via webapi complete");
};

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

/**
 * Record a repost accusation. POST /api/message-processing/count-repost
 * @param {string} userid - Author of the accused message
 * @param {string} msgid - Accused message id
 * @param {string} accuserid - User who added the repost emoji
 * @returns {Promise<Array>} milestones newly achieved by this count, if any
 */
export const countRepost = async (userid, msgid, accuserid) => {
  if (!msgid || !userid || !accuserid) return [];
  const { data } = await api.post("/api/message-processing/count-repost", {
    app: "fluxer",
    userid,
    msgid,
    accuser: accuserid,
    repost: 1,
  });
  return Array.isArray(data?.milestones) ? data.milestones : [];
};

/**
 * Withdraw a repost accusation. POST /api/message-processing/count-repost
 * @param {string} userid - Author of the accused message
 * @param {string} msgid - Accused message id
 * @param {string} accuserid - User who removed the repost emoji
 * @returns {Promise<void>}
 */
export const uncountRepost = async (userid, msgid, accuserid) => {
  if (!msgid || !userid || !accuserid) return;
  await api.post("/api/message-processing/count-repost", {
    app: "fluxer",
    userid,
    msgid,
    accuser: accuserid,
    repost: -1,
  });
};
