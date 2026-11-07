import * as api from "./client.js";
import { downloadStickerImage, mapWithConcurrency } from "./utilities/emojiFiles.js";
import { guildId } from "../configVars.js";

/**
 * Sync server sticker list with the web API. Fully replaces this guild's sticker catalog.
 * Downloads each sticker's image into the shared emoji files volume first (skipping Lottie
 * stickers, which have no raster image), so the import payload can carry its resolved path.
 * POST /api/message-processing/sticker-import
 * @param {Iterable<import('discord.js').Sticker>} stickerObjectList - e.g. guild.stickers (Collection)
 */
export const importStickerList = async (stickerObjectList) => {
  const list = Array.isArray(stickerObjectList)
    ? stickerObjectList
    : Array.from(stickerObjectList.values?.() ?? stickerObjectList);
  const imagePaths = await mapWithConcurrency(list, 10, (s) =>
    downloadStickerImage({ name: String(s.name), format: s.format, url: s.url }),
  );
  const stickers = list.map((s, i) => ({
    id: String(s.id),
    name: String(s.name),
    imagePath: imagePaths[i],
  }));
  const path = "/api/message-processing/sticker-import";
  await api.postInChunks(path, { app: "discord", guildId, prune: false }, "stickers", stickers);
  await api.post(path, { app: "discord", guildId, stickers: [], prune: true, liveIds: stickers.map((s) => s.id) });
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
 * @returns {Promise<Array<{ emoji: { emoid: string, app: string, emoji: string, frequency: number, animated: number, type: string } }>>} `emoji` is the full guild_emojis row.
 */
export const getTopStickers = async (number = 5) => {
  const { data } = await api.post("/api/leaderboards/sticker", {
    limit: number,
  });
  if (!data?.ok || !Array.isArray(data.top)) return [];
  return data.top;
};
