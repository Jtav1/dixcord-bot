import { parseEmoji } from "discord.js";

import { describeApiError } from "../../../api/client.js";
import { countEmoji } from "../../../api/emojis.js";
import { getMinusEmoji, getPlusEmoji } from "../../../configStore.js";
import { doplus, dominus } from "./plusplus.js";

/**
 * Detect and record emoji usage in a message's text content. Also applies a single +/- vote
 * when the message is a reply containing exactly one configured plus/minus emoji.
 * @param {import('discord.js').Message} rawMessage
 * @returns {Promise<void>}
 */
export const emojiDetector = async (rawMessage) => {
  const EMOJIREGEX =
    /((<|<a):?:\w+:?\d+>)|\p{Emoji_Presentation}|\p{Extended_Pictographic}/gmu;
  const emojiMatcher = (str) => str.match(EMOJIREGEX);

  const emoAry = emojiMatcher(rawMessage.content) || [];
  if (emoAry.length === 0) return;

  // parseEmoji returns null for malformed near-matches (e.g. a custom-emoji-like tag whose
  // name/id fails discord.js's stricter internal format check) - drop those rather than crash.
  const mapEmoAry = emoAry.map((emo) => parseEmoji(emo)).filter(Boolean);
  if (mapEmoAry.length === 0) return;

  const messageType = rawMessage.reference ? "reply" : "msg";
  // Forwarded messages also set `reference`, but have no repliedUser - guard against that.
  const repliedUser = rawMessage.mentions.repliedUser;

  const plusEmoji = getPlusEmoji();
  const minusEmoji = getMinusEmoji();
  const plusEmojiCount = mapEmoAry.filter((emo) => emo.id === plusEmoji).length;
  const minusEmojiCount = mapEmoAry.filter((emo) => emo.id === minusEmoji).length;
  const doPlusMinus = plusEmojiCount + minusEmojiCount === 1;

  // Sequential, not forEach/Promise.all: the same emoji can appear multiple times in one
  // message, and concurrent countEmoji calls for a not-yet-catalogued emoji race on webapi's
  // insert-if-missing check (duplicate-key error). Awaiting one at a time avoids that race.
  for (const emo of mapEmoAry) {
    if (emo.id === plusEmoji && doPlusMinus && messageType === "reply" && repliedUser) {
      await doplus(repliedUser.id, "user", rawMessage.author.id);
    } else if (emo.id === minusEmoji && doPlusMinus && messageType === "reply" && repliedUser) {
      await dominus(repliedUser.id, "user", rawMessage.author.id);
    } else {
      try {
        await countEmoji(emo.name, emo.id, rawMessage.author.id);
      } catch (err) {
        console.error(
          `bot: countEmoji failed for emoji "${emo.id ?? emo.name}" in message ${rawMessage.id} from user ${rawMessage.author.id}: ${describeApiError(err)}`,
        );
      }
    }
  }
};
