import { describeApiError } from "../../../api/client.js";
import { countSticker } from "../../../api/stickers.js";

/**
 * Detect and record sticker usage in a message.
 * @param {import('discord.js').Message} rawMessage
 * @returns {Promise<void>}
 */
export const stickerDetector = async (rawMessage) => {
  if (!rawMessage.stickers || rawMessage.stickers.size === 0) return;

  // Sequential, matching emojiDetector.js: avoids a duplicate-key race on webapi if the same
  // sticker were ever sent more than once in one message.
  for (const sticker of rawMessage.stickers.values()) {
    try {
      await countSticker(sticker.name, sticker.id, rawMessage.author.id);
    } catch (err) {
      console.error(
        `bot: countSticker failed for sticker "${sticker.id ?? sticker.name}" in message ${rawMessage.id} from user ${rawMessage.author.id}: ${describeApiError(err)}`,
      );
    }
  }
};
