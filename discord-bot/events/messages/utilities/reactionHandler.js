import * as api from "../../../api/client.js";
import { messagePinner } from "./messagePinner.js";
import { doplus, dominus } from "./plusplus.js";
import { countEmoji, countRepost, uncountRepost } from "../../../api/emojis.js";

/** Fetch a random pin quip from the API; returns fallback if unavailable. */
async function getRandomPinQuip() {
  try {
    const { data } = await api.get("/api/pin-quips/random");
    if (data?.ok && data?.quip) return data.quip;
  } catch (_) {}
  return "PINNED";
}

/**
 * Handle messageReactionAdd: pin threshold, plus/minus votes, emoji counting, repost counting.
 * @param {MessageReaction} reaction
 * @param {User} user
 * @param {{ client: Client, pinEmoji: string, pinThreshold: number, plusEmoji: string, minusEmoji: string, repostEmojiId: string }} options
 */
export async function handleReactionAdd(reaction, user, options) {
  const {
    client,
    pinEmoji,
    pinThreshold,
    plusEmoji,
    minusEmoji,
    repostEmojiId,
  } = options;

  const message = !reaction.message.author
    ? await reaction.message.fetch()
    : reaction.message;

  const allReactions = message.reactions.valueOf();
  const pinReact = allReactions.get(pinEmoji);

  if (pinReact && pinReact.count === pinThreshold) {
    const res = await messagePinner(message, pinReact, user, client);
    if (res) {
      const randomReply = await getRandomPinQuip();
      message.reply(randomReply);
    }
  }

  if (reaction._emoji.id === plusEmoji && user.id !== message.author.id) {
    await doplus(reaction.message.author.id, "user", user.id);
  }
  if (reaction._emoji.id === minusEmoji && user.id !== message.author.id) {
    await dominus(reaction.message.author.id, "user", user.id);
  }

  if (
    reaction._emoji.name !== pinEmoji &&
    reaction._emoji.id !== plusEmoji &&
    reaction._emoji.id !== minusEmoji
  ) {
    await countEmoji(reaction._emoji.name, reaction._emoji.id, user.id);
  }

  const repostReact = allReactions.get(repostEmojiId);
  if (repostReact) {
    countRepost(message.author.id, message.id, user.id);
  }
}

/**
 * Handle messageReactionRemove: uncount repost, reverse plus/minus votes.
 * @param {MessageReaction} reaction
 * @param {User} user
 * @param {{ plusEmoji: string, minusEmoji: string, repostEmojiId: string }} options
 */
export async function handleReactionRemove(reaction, user, options) {
  const { plusEmoji, minusEmoji, repostEmojiId } = options;

  const message = !reaction.message.author
    ? await reaction.message.fetch()
    : reaction.message;

  if (reaction._emoji.id === repostEmojiId) {
    uncountRepost(message.id, user.id);
  }

  if (reaction._emoji.id === plusEmoji && user.id !== message.author.id) {
    await dominus(reaction.message.author.id, "user", user.id);
  }
  if (reaction._emoji.id === minusEmoji && user.id !== message.author.id) {
    await doplus(reaction.message.author.id, "user", user.id);
  }
}
