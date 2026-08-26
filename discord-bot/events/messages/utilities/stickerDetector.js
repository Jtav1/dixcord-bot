import { countSticker } from "../../../api/stickers.js";

// stickerDetector
//  logs instances of each sticker sent in the message
//  return: none/void
export const stickerDetector = async (rawMessage) => {
  if (!rawMessage.stickers || rawMessage.stickers.size === 0) return;

  rawMessage.stickers.forEach((sticker) => {
    countSticker(sticker.name, sticker.id, rawMessage.author.id);
  });
};
