import * as api from "./client.js";
import { guildId } from "../configVars.js";

/**
 * Sync server sticker list with the web API. Fully replaces this guild's sticker catalog.
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
  await api.post("/api/message-processing/sticker-import", { app: "discord", guildId, stickers });
  console.log("bot: sticker import via webapi complete");
};

/**
 * Record sticker usage. POST /api/message-processing/sticker-count
 * @param {string} stickerName - Sticker name
 * @param {string} stickerId - Sticker ID
 * @param {string|null} [userid] - User who sent the sticker
 * @returns {Promise<Array>} milestones newly achieved by this count, if any
 */
export const countSticker = async (stickerName, stickerId, userid = null) => {
  const authorId = userid || undefined;
  if (!stickerName) return [];
  const { data } = await api.post("/api/message-processing/sticker-count", {
    app: "discord",
    guildId,
    authorId,
    stickers: [{ name: stickerName, id: stickerId }],
  });
  return Array.isArray(data?.milestones) ? data.milestones : [];
};

/**
 * Top used stickers. POST /api/leaderboards/sticker
 * @param {number} number - Limit (default 5, max 50)
 * @returns {Promise<Array<{ emoji: { emoid: string, app: string, emoji: string, frequency: number, animated: number, type: string } }>>} `emoji` is the full emoji_frequency row.
 */
export const getTopStickers = async (number = 5) => {
  const { data } = await api.post("/api/leaderboards/sticker", {
    limit: number,
  });
  if (!data?.ok || !Array.isArray(data.top)) return [];
  return data.top;
};
