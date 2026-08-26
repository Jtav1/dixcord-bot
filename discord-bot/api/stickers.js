import * as api from "./client.js";

/**
 * Sync server sticker list with the web API.
 * POST /api/message-processing/sticker-import
 * @param {Iterable<{ id: string, name: string }>} stickerObjectList - e.g. guild.stickers (Collection)
 */
export const importStickerList = async (stickerObjectList) => {
  const list = Array.isArray(stickerObjectList)
    ? stickerObjectList
    : Array.from(stickerObjectList.values?.() ?? stickerObjectList);
  const stickers = list.map((s) => ({
    id: String(s.id),
    name: String(s.name),
  }));
  await api.post("/api/message-processing/sticker-import", { stickers });
  console.log("bot: sticker import via webapi complete");
};

/**
 * Record sticker usage. POST /api/message-processing/sticker-count
 * @param {string} stickerName - Sticker name
 * @param {string} stickerId - Sticker ID
 * @param {string|null} [userid] - User who sent the sticker
 */
export const countSticker = async (stickerName, stickerId, userid = null) => {
  const authorId = userid || undefined;
  if (!stickerName) return;
  await api.post("/api/message-processing/sticker-count", {
    app: "discord",
    authorId,
    stickers: [{ name: stickerName, id: stickerId }],
  });
};

/**
 * Top used stickers. POST /api/leaderboards/sticker
 * @param {number} number - Limit (default 5, max 50)
 * @returns {Promise<Array<{ emoji: string, frequency: number, emoid: string }>>}
 */
export const getTopStickers = async (number = 5) => {
  const { data } = await api.post("/api/leaderboards/sticker", {
    limit: number,
  });
  if (!data?.ok || !Array.isArray(data.top)) return [];
  return data.top;
};
