import { countEmoji } from "../../../middleware/emojis.js";
// emojiDetector
//  logs instances of each emojis in the message
//  return: none/void
const emojiDetector = (rawMessage) => {
  const EMOJIREGEX =
    /((<|<a):?:\w+:?\d+>)|\p{Emoji_Presentation}|\p{Extended_Pictographic}/gmu;
  const emojiDetector = (str) => str.match(EMOJIREGEX);

  let emoAry = emojiDetector(rawMessage.content) || [];

  emoAry.forEach((emo) => {
    console.log(emo);
    if (emo.length > 0) countEmoji(emo, rawMessage.author.id);
  });
};

export default emojiDetector;
