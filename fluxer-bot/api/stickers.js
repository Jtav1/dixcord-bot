import * as api from "./client.js";
import { downloadStickerImage, mapWithConcurrency } from "./utilities/emojiFiles.js";
import { guildId } from "../configVars.js";

/**
 * Sync server sticker list with the web API. Fully replaces this guild's sticker catalog.
 * Downloads each sticker's image into the shared emoji files volume first, so the import payload
 * can carry its resolved relative path.
 * POST /api/message-processing/sticker-import
 * @param {Array<import('@fluxerjs/core').GuildSticker>} stickerList - e.g. from guild.fetchStickers()
 */
export const importStickerList = async (stickerList) => {
  const imagePaths = await mapWithConcurrency(stickerList, 10, (s) =>
    downloadStickerImage({ name: String(s.name), animated: Boolean(s.animated), url: s.url }),
  );
  const stickers = stickerList.map((s, i) => ({
    id: String(s.id),
    name: String(s.name),
    imagePath: imagePaths[i],
  }));
  const path = "/api/message-processing/sticker-import";
  await api.postInChunks(path, { app: "fluxer", guildId, prune: false }, "stickers", stickers);
  await api.post(path, { app: "fluxer", guildId, stickers: [], prune: true, liveIds: stickers.map((s) => s.id) });
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
    app: "fluxer",
    guildId,
    authorId,
    stickers: [{ name: stickerName, id: stickerId }],
  });
  return Array.isArray(data?.milestones) ? data.milestones : [];
};
