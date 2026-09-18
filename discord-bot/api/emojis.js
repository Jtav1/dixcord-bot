import * as api from "./client.js";
import { guildId } from "../configVars.js";

/**
 * Sync server emoji list with the web API. Fully replaces this guild's guild_emojis catalog.
 * POST /api/message-processing/emoji-import
 * @param {Iterable<import('discord.js').GuildEmoji>} emojiObjectList - e.g. guild.emojis (Collection)
 */
export const importEmojiList = async (emojiObjectList) => {
  const list = Array.isArray(emojiObjectList)
    ? emojiObjectList
    : Array.from(emojiObjectList.values?.() ?? emojiObjectList);
  const emojis = list.map((e) => ({
    id: String(e.id),
    name: String(e.name),
    animated: Boolean(e.animated),
    available: e.available ?? null,
    managed: e.managed ?? null,
    requiresColons: e.requiresColons ?? null,
    roles: e.roles?.cache ? [...e.roles.cache.keys()] : [],
    type: "emoji",
  }));
  await api.post("/api/message-processing/emoji-import", { app: "discord", guildId, emojis });
  console.log("bot: emoji import via webapi complete");
};

/**
 * List custom emoji catalog rows that carry a guild_id. GET /api/message-processing/emoji-catalog
 * @returns {Promise<Array<{ id: string, guildId: string, name: string, animated: boolean, frequency: number, sourceFrequency: number }>>}
 */
export const listEmojiCatalog = async () => {
  const { data } = await api.get("/api/message-processing/emoji-catalog", {
    params: { app: "discord" },
  });
  return Array.isArray(data?.emojis) ? data.emojis : [];
};

/**
 * Delete one custom emoji catalog row by id. DELETE /api/message-processing/emoji-catalog/:id
 * @param {string} id
 */
export const deleteEmojiCatalogRow = async (id) => {
  await api.del(`/api/message-processing/emoji-catalog/${id}`);
};

/**
 * Migrate one emoji's usage total from emoji_frequency into guild_emojis.frequency.
 * POST /api/message-processing/emoji-catalog/:id/migrate-frequency
 * @param {string} id
 * @returns {Promise<number>} the frequency written
 */
export const migrateEmojiCatalogFrequency = async (id) => {
  const { data } = await api.post(`/api/message-processing/emoji-catalog/${id}/migrate-frequency`);
  return Number(data?.frequency) || 0;
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
    app: "discord",
    guildId,
    authorId,
    emojis,
  });
  return Array.isArray(data?.milestones) ? data.milestones : [];
};

/**
 * Top used emojis. POST /api/leaderboards/emoji
 * @param {number} number - Limit (default 5, max 50)
 * @returns {Promise<Array<{ emoji: { emoid: string, app: string, emoji: string, frequency: number, animated: number, type: string } }>>} `emoji` is the full emoji_frequency row.
 */
export const getTopEmoji = async (number = 5) => {
  const { data } = await api.post("/api/leaderboards/emoji", {
    limit: number,
  });
  if (!data?.ok || !Array.isArray(data.top)) return [];
  return data.top;
};

/**
 * Record a repost accusation. POST /api/message-processing/count-repost
 * @param {string} userid - Message author (accused)
 * @param {string} msgid - Message ID
 * @param {string} accuserid - User who added repost reaction
 * @returns {Promise<Array>} milestones newly achieved by this count, if any
 */
export const countRepost = async (userid, msgid, accuserid) => {
  if (!msgid || !userid || !accuserid) return [];
  const { data } = await api.post("/api/message-processing/count-repost", {
    app: "discord",
    userid,
    msgid,
    accuser: accuserid,
    repost: 1,
  });
  return Array.isArray(data?.milestones) ? data.milestones : [];
};

/**
 * Withdraw a repost accusation. POST /api/message-processing/count-repost (repost: -1)
 * @param {string} userid - Message author (accused)
 * @param {string} msgid - Message ID
 * @param {string} accuserid - User who is removing their repost reaction
 */
export const uncountRepost = async (userid, msgid, accuserid) => {
  if (!msgid || !userid || !accuserid) return;
  await api.post("/api/message-processing/count-repost", {
    app: "discord",
    userid,
    msgid,
    accuser: accuserid,
    repost: -1,
  });
};

/**
 * Top reposters by accusation count. POST /api/leaderboards/repost
 * @param {number} number - Limit (default 5, max 50)
 * @returns {Promise<Array<{ userid: string, count: number }>>}
 */
export const getTopReposters = async (number = 5) => {
  const { data } = await api.post("/api/leaderboards/repost", {
    app: "discord",
    limit: number,
  });
  if (!data?.ok || !Array.isArray(data.top)) return [];
  return data.top;
};

/**
 * Repost count for a user. GET /api/leaderboards/repost/user/:userId
 * @param {string} userid - User ID
 * @returns {Promise<number>}
 */
export const getRepostsForUser = async (userid) => {
  if (!userid) return 0;
  const { data } = await api.get(`/api/leaderboards/repost/user/${userid}`, {
    params: { app: "discord" },
  });
  if (!data?.ok) return 0;
  return Number(data.count) ?? 0;
};
