import * as api from "./client.js";

/**
 * Sync server emoji list with the web API.
 * POST /api/message-processing/emoji-import
 * @param {Iterable<{ id: string, name: string, animated?: boolean, type?: string }>} emojiObjectList - e.g. guild.emojis (Collection)
 */
export const importEmojiList = async (emojiObjectList) => {
  const list = Array.isArray(emojiObjectList)
    ? emojiObjectList
    : Array.from(emojiObjectList.values?.() ?? emojiObjectList);
  const emojis = list.map((e) => ({
    id: String(e.id),
    name: String(e.name),
    animated: Boolean(e.animated),
    type: "emoji",
  }));
  await api.post("/api/message-processing/emoji-import", { emojis });
  console.log("db: emoji import complete (via webapi)");
};

/**
 * Record emoji usage. POST /api/message-processing/emoji-count
 * @param {string} emojiName - Emoji name
 * @param {string} [emojiId] - Emoji ID (optional for unicode)
 * @param {string|null} [userid] - User who used the emoji (author/reactor)
 */
export const countEmoji = async (emojiName, emojiId, userid = null) => {
  const authorId = userid || undefined;
  const emojis = [{ name: emojiName, id: emojiId ?? undefined }].filter(
    (e) => e.name != null && e.name !== "",
  );
  if (emojis.length === 0) return;
  await api.post("/api/message-processing/emoji-count", {
    app: "discord",
    authorId,
    emojis,
  });
};

/**
 * Top used emojis. POST /api/leaderboards/emoji
 * @param {number} number - Limit (default 5, max 50)
 * @returns {Promise<Array<{ emoji: string, frequency: number, emoid: string, animated?: number }>>}
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
 */
export const countRepost = async (userid, msgid, accuserid) => {
  if (!msgid || !userid || !accuserid) return;
  await api.post("/api/message-processing/count-repost", {
    app: "discord",
    userid,
    msgid,
    accuser: accuserid,
    repost: 1,
  });
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
