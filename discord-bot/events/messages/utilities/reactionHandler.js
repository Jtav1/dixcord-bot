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
 * Resolve a possibly-partial message to full data (needed for `.author`, `.reactions`, etc.).
 * Partials.Message is enabled (bot.js), so messages not in the client's cache arrive partial.
 * @param {import('discord.js').MessageReaction} reaction
 * @returns {Promise<import('discord.js').Message | null>} null if the fetch failed (e.g. message deleted before fetch completed)
 */
async function resolveMessage(reaction) {
  if (!reaction.message.partial) return reaction.message;
  try {
    return await reaction.message.fetch();
  } catch (err) {
    console.error(
      `bot: reactionHandler could not fetch a partial message (likely deleted before fetch completed): ${api.describeApiError(err)}`,
    );
    return null;
  }
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

  const message = await resolveMessage(reaction);
  if (!message) return;

  const emoji = reaction.emoji;
  if (!emoji) {
    console.error(
      `bot: reactionHandler got a reaction with no resolvable emoji on message ${message.id} from user ${user.id}; skipping`,
    );
    return;
  }

  const allReactions = message.reactions.valueOf();
  const pinReact = allReactions.get(pinEmoji);

  if (pinReact && pinReact.count === pinThreshold) {
    const res = await messagePinner(message, pinReact, user, client);
    if (res) {
      const randomReply = await getRandomPinQuip();
      message.reply(randomReply);
    }
  }

  if (
    (emoji.id === plusEmoji || emoji.name === plusEmoji) &&
    user.id !== message.author.id
  ) {
    await doplus(message.author.id, "user", user.id);
  }

  if (
    (emoji.id === minusEmoji || emoji.name === minusEmoji) &&
    user.id !== message.author.id
  ) {
    await dominus(message.author.id, "user", user.id);
  }

  if (
    emoji.name !== pinEmoji &&
    emoji.id !== plusEmoji &&
    emoji.id !== minusEmoji
  ) {
    if (reaction.partial) {
      // A partial reaction's emoji data isn't fully cached - typically a custom emoji from a
      // server this bot isn't in. Rather than spend a Discord API call resolving it, just skip
      // counting it.
      console.log(
        `bot: skipping emoji count for a partial reaction (likely a custom emoji from another server) on message ${message.id} from user ${user.id}`,
      );
    } else {
      try {
        await countEmoji(emoji.name, emoji.id, user.id);
      } catch (err) {
        console.error(
          `bot: countEmoji failed for reaction emoji "${emoji.id ?? emoji.name}" on message ${message.id} from user ${user.id}: ${api.describeApiError(err)}`,
        );
      }
    }
  }

  const repostReact = allReactions.get(repostEmojiId);
  if (repostReact) {
    countRepost(message.author.id, message.id, user.id).catch((err) => {
      console.error(
        `bot: countRepost failed for message ${message.id} (accused ${message.author.id}, accuser ${user.id}): ${api.describeApiError(err)}`,
      );
    });
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

  const message = await resolveMessage(reaction);
  if (!message) return;

  const emoji = reaction.emoji;
  if (!emoji) {
    console.error(
      `bot: reactionHandler got a reaction-remove with no resolvable emoji on message ${message.id} from user ${user.id}; skipping`,
    );
    return;
  }

  if (emoji.id === repostEmojiId) {
    uncountRepost(message.author.id, message.id, user.id).catch((err) => {
      console.error(
        `bot: uncountRepost failed for message ${message.id} (accused ${message.author.id}, accuser ${user.id}): ${api.describeApiError(err)}`,
      );
    });
  }

  if (
    (emoji.id === plusEmoji || emoji.name === plusEmoji) &&
    user.id !== message.author.id
  ) {
    await dominus(message.author.id, "user", user.id);
  }

  if (
    (emoji.id === minusEmoji || emoji.name === minusEmoji) &&
    user.id !== message.author.id
  ) {
    await doplus(message.author.id, "user", user.id);
  }
}
