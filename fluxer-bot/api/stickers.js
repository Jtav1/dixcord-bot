import * as api from "./client.js";
import { guildId } from "../configVars.js";

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
