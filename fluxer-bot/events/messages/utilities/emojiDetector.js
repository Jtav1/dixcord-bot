import { describeApiError } from "../../../api/client.js";
import { countEmoji } from "../../../api/emojis.js";
import {
  getMinusEmoji,
  getPlusEmoji,
  isPlusPlusEnabled,
  isEmojiTrackingEnabled,
} from "../../../configStore.js";
import { doplus, dominus } from "./plusplus.js";
import { emojisMatch, toEmojiObject } from "../../../utilities/emojiCompare.js";
import { announceMilestones } from "../../../utilities/milestoneNotifier.js";

const EMOJIREGEX =
  /((<|<a):?:\w+:?\d+>)|\p{Emoji_Presentation}|\p{Extended_Pictographic}/gmu;
const CUSTOM_EMOJI_TOKEN_REGEX = /^<(a)?:(\w+):(\d+)>$/;

/**
 * Parse one regex match into a comparable emoji token. @fluxerjs/core has no parseEmoji()
 * helper (unlike discord.js) — this does the same job: a custom-emoji tag (`<a?:name:id>`)
 * becomes `{id, name, animated}`; anything else (a unicode match) is treated as-is.
 * @param {string} raw
 * @returns {{ id: string|null, name: string, animated: boolean }|null}
 */
function parseEmojiToken(raw) {
  const customMatch = CUSTOM_EMOJI_TOKEN_REGEX.exec(raw);
  if (customMatch) {
    const [, animatedFlag, name, id] = customMatch;
    return { id, name, animated: Boolean(animatedFlag) };
  }
  if (raw.startsWith("<")) return null; // malformed near-match (e.g. bad custom-emoji tag)
  return { id: null, name: raw, animated: false };
}

/**
 * Detect and record emoji usage in a message's text content. Also applies a single +/- vote
 * when the message is a reply containing exactly one configured plus/minus emoji.
 * @param {import('@fluxerjs/core').Message} rawMessage
 * @returns {Promise<void>}
 */
export const emojiDetector = async (rawMessage) => {
  const plusMinusEnabled = isPlusPlusEnabled();
  const emojiTrackingEnabled = isEmojiTrackingEnabled();
  if (!plusMinusEnabled && !emojiTrackingEnabled) return;

  const emoAry = rawMessage.content.match(EMOJIREGEX) || [];
  if (emoAry.length === 0) return;

  const mapEmoAry = emoAry.map(parseEmojiToken).filter(Boolean);
  if (mapEmoAry.length === 0) return;

  const messageType = rawMessage.messageReference ? "reply" : "msg";
  // Forwarded messages can also set messageReference, but have no resolved referencedMessage.
  const repliedUser = rawMessage.referencedMessage?.author ?? null;

  const plusEmoji = getPlusEmoji();
  const minusEmoji = getMinusEmoji();
  const plusEmojiCount = mapEmoAry.filter((emo) => emojisMatch(toEmojiObject(emo), plusEmoji)).length;
  const minusEmojiCount = mapEmoAry.filter((emo) => emojisMatch(toEmojiObject(emo), minusEmoji)).length;
  const doPlusMinus = plusEmojiCount + minusEmojiCount === 1;

  // Sequential, not forEach/Promise.all: the same emoji can appear multiple times in one
  // message, and concurrent countEmoji calls for a not-yet-catalogued emoji race on webapi's
  // insert-if-missing check (duplicate-key error). Awaiting one at a time avoids that race.
  for (const emo of mapEmoAry) {
    const emoObj = toEmojiObject(emo);
    if (plusMinusEnabled && emojisMatch(emoObj, plusEmoji) && doPlusMinus && messageType === "reply" && repliedUser) {
      const milestones = await doplus(repliedUser.id, "user", rawMessage.author.id);
      await announceMilestones(rawMessage, milestones);
    } else if (plusMinusEnabled && emojisMatch(emoObj, minusEmoji) && doPlusMinus && messageType === "reply" && repliedUser) {
      const milestones = await dominus(repliedUser.id, "user", rawMessage.author.id);
      await announceMilestones(rawMessage, milestones);
    } else if (emojiTrackingEnabled) {
      // A custom-emoji id missing from the guild's own emoji cache belongs to an unknown guild.
      if (emo.id != null && !rawMessage.guild?.emojis.has(emo.id)) {
        console.log(
          `bot: skipping emoji count for external/unknown-guild custom emoji ${emo.id} in message ${rawMessage.id} from user ${rawMessage.author.id}`,
        );
        continue;
      }
      try {
        const milestones = await countEmoji(emo.name, emo.id, rawMessage.author.id);
        await announceMilestones(rawMessage, milestones);
      } catch (err) {
        console.error(
          `bot: countEmoji failed for emoji "${emo.id ?? emo.name}" in message ${rawMessage.id} from user ${rawMessage.author.id}: ${describeApiError(err)}`,
        );
      }
    }
  }
};
