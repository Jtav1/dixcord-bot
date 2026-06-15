import { parseEmoji } from "discord.js";

import { countEmoji } from "../../../api/emojis.js";
import { getMinusEmoji, getPlusEmoji } from "../../../configStore.js";
import { doplus, dominus } from "./plusplus.js";

// emojiDetector
//  logs instances of each emojis in the message
//  return: none/void
//prettier-ignore
export const emojiDetector = async (rawMessage) => {
  const EMOJIREGEX =
    /((<|<a):?:\w+:?\d+>)|\p{Emoji_Presentation}|\p{Extended_Pictographic}/gmu;
  const emojiMatcher = (str) => str.match(EMOJIREGEX);

  let emoAry = emojiMatcher(rawMessage.content) || [];
  if (emoAry.length > 0) {
    let mapEmoAry = emoAry.map((emo) => parseEmoji(emo));

    let messageType = rawMessage.reference ? "reply" : "msg";

    let doPlusMinus = false;
    const plusEmoji = getPlusEmoji();
    const minusEmoji = getMinusEmoji();
    const plusEmojiCount = mapEmoAry.filter((emo) => emo.id === plusEmoji).length;
    const minusEmojiCount = mapEmoAry.filter( (emo) => emo.id === minusEmoji).length;

    if (plusEmojiCount + minusEmojiCount === 1) {
      doPlusMinus = true;
    }

    mapEmoAry.forEach((emo) => {
      if (emo.id === plusEmoji && doPlusMinus && messageType === "reply") {
          doplus(rawMessage.mentions.repliedUser.id, "user", rawMessage.author.id); // plus the user being replied to with this emoji
      } else if (emo.id === minusEmoji && doPlusMinus && messageType === "reply") {
          dominus(rawMessage.mentions.repliedUser.id, "user", rawMessage.author.id); // minus the user being replied to with this emoji
      } else if (emo) {
        countEmoji(emo.name, emo.id, rawMessage.author.id);
      }
    });
  }
};
