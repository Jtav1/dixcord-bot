import * as api from "./client.js";
import { guildId } from "../configVars.js";

/**
 * Sync server sticker list with the web API. Fully replaces this guild's sticker catalog.
 * POST /api/message-processing/sticker-import
 * @param {Array<import('@fluxerjs/core').GuildSticker>} stickerList - e.g. from guild.fetchStickers()
 */
export const importStickerList = async (stickerList) => {
  const stickers = stickerList.map((s) => ({
    id: String(s.id),
    name: String(s.name),
  }));
  await api.post("/api/message-processing/sticker-import", { app: "fluxer", guildId, stickers });
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
