import * as api from "../../../api/client.js";
import { messagePinner } from "./messagePinner.js";
import { doplus, dominus } from "./plusplus.js";
import { countEmoji, countRepost, uncountRepost } from "../../../api/emojis.js";
import {
  recordTimeoutVote,
  removeTimeoutVote,
} from "../../../api/timeoutVotes.js";
import { incrementCounter } from "../../../utilities/metrics.js";
import { emojisMatch, toEmojiObject } from "../../../utilities/emojiCompare.js";
import { announceMilestones } from "../../../utilities/milestoneNotifier.js";
import { timeoutMember } from "../../../utilities/timeoutMember.js";

/**
 * Weight of one user's timeout vote based on their roles: 3x if they hold the triple-vote role,
 * 2x if they hold the double-vote role (checked in that order so triple wins if a user has both),
 * 1x otherwise.
 * @param {import('discord.js').GuildMember|null} member
 * @param {string} doubleRoleId
 * @param {string} tripleRoleId
 * @returns {number}
 */
function resolveTimeoutVoteWeight(member, doubleRoleId, tripleRoleId) {
  let voteQty = 1;
  if (!member) voteQty = 0;
  if (tripleRoleId && member.roles.cache.has(tripleRoleId)) voteQty = 3;
  if (doubleRoleId && member.roles.cache.has(doubleRoleId)) voteQty = 2;
  console.log("Recording timeout votes: " + voteQty);
  return voteQty;
}

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
 * @param {{ client: Client, pinEmoji: object|null, pinThreshold: number, plusEmoji: object|null, minusEmoji: object|null, repostEmojiId: object|null, pinSystemEnabled: boolean, plusPlusEnabled: boolean, emojiTrackingEnabled: boolean, repostDetectionEnabled: boolean }} options - the *Emoji options are resolved emoji objects (see configStore.js), not bare strings.
 */
export async function handleReactionAdd(reaction, user, options) {
  const {
    client,
    pinEmoji,
    pinThreshold,
    plusEmoji,
    minusEmoji,
    repostEmojiId,
    timeoutVoteEmoji,
    timeoutVoteDoubleRoleId,
    timeoutVoteTripleRoleId,
    pinSystemEnabled,
    plusPlusEnabled,
    emojiTrackingEnabled,
    repostDetectionEnabled,
    timeoutVoteEnabled,
  } = options;

  const message = await resolveMessage(reaction);
  if (!message) return;
  incrementCounter("reactionsProcessedTotal");

  const emoji = reaction.emoji;
  if (!emoji) {
    console.error(
      `bot: reactionHandler got a reaction with no resolvable emoji on message ${message.id} from user ${user.id}; skipping`,
    );
    return;
  }
  const emojiObj = toEmojiObject(emoji);

  const allReactions = message.reactions.valueOf();
  const pinReact = pinEmoji
    ? [...allReactions.values()].find((r) =>
        emojisMatch(toEmojiObject(r.emoji), pinEmoji),
      )
    : null;

  if (pinSystemEnabled && pinReact && pinReact.count === pinThreshold) {
    const res = await messagePinner(message, pinReact, user, client);
    if (res.sent) {
      incrementCounter("pinsLoggedTotal");
      const randomReply = await getRandomPinQuip();
      message.reply(randomReply);
      await announceMilestones(message, res.milestones);
    }
  }

  if (
    plusPlusEnabled &&
    emojisMatch(emojiObj, plusEmoji) &&
    user.id !== message.author.id
  ) {
    const milestones = await doplus(message.author.id, "user", user.id);
    await announceMilestones(message, milestones);
  }

  if (
    plusPlusEnabled &&
    emojisMatch(emojiObj, minusEmoji) &&
    user.id !== message.author.id
  ) {
    const milestones = await dominus(message.author.id, "user", user.id);
    await announceMilestones(message, milestones);
  }

  if (
    timeoutVoteEnabled &&
    emojisMatch(emojiObj, timeoutVoteEmoji) &&
    user.id !== message.author.id
  ) {
    console.log("timeout vote detected");
    console.log(timeoutVoteEnabled);
    console.log(emojiObj);
    console.log(timeoutVoteEmoji);
    const voterMember = await message.guild.members
      .fetch(user.id)
      .catch(() => null);
    const weight = resolveTimeoutVoteWeight(
      voterMember,
      timeoutVoteDoubleRoleId,
      timeoutVoteTripleRoleId,
    );
    try {
      const result = await recordTimeoutVote(
        message.id,
        message.author.id,
        user.id,
        weight,
      );
      if (result.triggered) {
        const targetMember =
          message.member ??
          (await message.guild.members
            .fetch(message.author.id)
            .catch(() => null));
        if (targetMember) {
          try {
            await timeoutMember(
              targetMember,
              result.durationSeconds,
              "Timed out by community vote",
            );
            await message.channel.send(
              String(result.responseMessage).replace(
                "{user}",
                `<@${message.author.id}>`,
              ),
            );
          } catch (err) {
            console.error(
              `bot: failed to apply vote-timeout on message ${message.id} (target ${message.author.id}): ${err.message}`,
            );
          }
        }
      }
    } catch (err) {
      incrementCounter("apiCallErrorsTotal", "timeoutVotes");
      console.error(
        `bot: recordTimeoutVote failed for message ${message.id} (target ${message.author.id}, voter ${user.id}): ${api.describeApiError(err)}`,
      );
    }
  }

  if (
    emojiTrackingEnabled &&
    !emojisMatch(emojiObj, pinEmoji) &&
    !emojisMatch(emojiObj, plusEmoji) &&
    !emojisMatch(emojiObj, minusEmoji) &&
    !emojisMatch(emojiObj, timeoutVoteEmoji)
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
        const milestones = await countEmoji(emoji.name, emoji.id, user.id);
        incrementCounter("emojiCountedTotal");
        await announceMilestones(message, milestones);
      } catch (err) {
        incrementCounter("apiCallErrorsTotal", "emojis");
        console.error(
          `bot: countEmoji failed for reaction emoji "${emoji.id ?? emoji.name}" on message ${message.id} from user ${user.id}: ${api.describeApiError(err)}`,
        );
      }
    }
  }

  if (repostDetectionEnabled && emojisMatch(emojiObj, repostEmojiId)) {
    countRepost(message.author.id, message.id, user.id)
      .then((milestones) => {
        incrementCounter("repostsDetectedTotal");
        return announceMilestones(message, milestones);
      })
      .catch((err) => {
        incrementCounter("apiCallErrorsTotal", "reposts");
        console.error(
          `bot: countRepost failed for message ${message.id} (accused ${message.author.id}, accuser ${user.id}): ${api.describeApiError(err)}`,
        );
      });
  }
}

/**
 * Handle messageReactionRemove: uncount repost, reverse plus/minus votes, un-count timeout votes.
 * @param {MessageReaction} reaction
 * @param {User} user
 * @param {{ plusEmoji: object|null, minusEmoji: object|null, repostEmojiId: object|null, timeoutVoteEmoji: object|null, plusPlusEnabled: boolean, repostDetectionEnabled: boolean, timeoutVoteEnabled: boolean }} options - the *Emoji options are resolved emoji objects (see configStore.js), not bare strings.
 */
export async function handleReactionRemove(reaction, user, options) {
  const {
    plusEmoji,
    minusEmoji,
    repostEmojiId,
    timeoutVoteEmoji,
    plusPlusEnabled,
    repostDetectionEnabled,
    timeoutVoteEnabled,
  } = options;

  const message = await resolveMessage(reaction);
  if (!message) return;
  incrementCounter("reactionsProcessedTotal");

  const emoji = reaction.emoji;
  if (!emoji) {
    console.error(
      `bot: reactionHandler got a reaction-remove with no resolvable emoji on message ${message.id} from user ${user.id}; skipping`,
    );
    return;
  }
  const emojiObj = toEmojiObject(emoji);

  if (repostDetectionEnabled && emojisMatch(emojiObj, repostEmojiId)) {
    uncountRepost(message.author.id, message.id, user.id).catch((err) => {
      console.error(
        `bot: uncountRepost failed for message ${message.id} (accused ${message.author.id}, accuser ${user.id}): ${api.describeApiError(err)}`,
      );
    });
  }

  if (
    plusPlusEnabled &&
    emojisMatch(emojiObj, plusEmoji) &&
    user.id !== message.author.id
  ) {
    const milestones = await dominus(message.author.id, "user", user.id);
    await announceMilestones(message, milestones);
  }

  if (
    plusPlusEnabled &&
    emojisMatch(emojiObj, minusEmoji) &&
    user.id !== message.author.id
  ) {
    const milestones = await doplus(message.author.id, "user", user.id);
    await announceMilestones(message, milestones);
  }

  if (timeoutVoteEnabled && emojisMatch(emojiObj, timeoutVoteEmoji)) {
    removeTimeoutVote(message.id, user.id).catch((err) => {
      incrementCounter("apiCallErrorsTotal", "timeoutVotes");
      console.error(
        `bot: removeTimeoutVote failed for message ${message.id} (voter ${user.id}): ${api.describeApiError(err)}`,
      );
    });
  }
}
