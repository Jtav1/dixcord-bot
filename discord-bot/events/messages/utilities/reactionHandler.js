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
  if (!member) return 0;
  if (tripleRoleId && member.roles.cache.has(tripleRoleId)) return 3;
  if (doubleRoleId && member.roles.cache.has(doubleRoleId)) return 2;
  return 1;
}

/**
 * Classify a reaction's emoji against every configured special-purpose emoji, comparing each
 * exactly once. The five purposes are mutually exclusive — first match wins — so an admin
 * accidentally reusing the same emoji for two purposes only ever triggers the first one.
 * @param {{app:string,emoid:string,emoji:string}} emojiObj
 * @param {{ pinEmoji?: object|null, plusEmoji?: object|null, minusEmoji?: object|null, timeoutVoteEmoji?: object|null, repostEmoji?: object|null }} configuredEmojis
 * @returns {"pin"|"plus"|"minus"|"timeoutVote"|"repost"|"generic"}
 */
function classifyReactionEmoji(
  emojiObj,
  { pinEmoji, plusEmoji, minusEmoji, timeoutVoteEmoji, repostEmoji },
) {
  if (emojisMatch(emojiObj, pinEmoji)) return "pin";
  if (emojisMatch(emojiObj, plusEmoji)) return "plus";
  if (emojisMatch(emojiObj, minusEmoji)) return "minus";
  if (emojisMatch(emojiObj, timeoutVoteEmoji)) return "timeoutVote";
  if (emojisMatch(emojiObj, repostEmoji)) return "repost";
  return "generic";
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
 * @param {{ client: Client, pinEmoji: object|null, pinThreshold: number, plusEmoji: object|null, minusEmoji: object|null, repostEmoji: object|null, pinSystemEnabled: boolean, plusPlusEnabled: boolean, emojiTrackingEnabled: boolean, repostDetectionEnabled: boolean }} options - the *Emoji options are resolved emoji objects (see configStore.js), not bare strings.
 */
export async function handleReactionAdd(reaction, user, options) {
  const {
    client,
    pinEmoji,
    pinThreshold,
    plusEmoji,
    minusEmoji,
    repostEmoji,
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
  const isSelfReaction = user.id === message.author.id;

  // Re-scans all reactions for pinEmoji, since threshold can be crossed regardless of which reaction fired.
  if (pinSystemEnabled && pinEmoji) {
    const allReactions = message.reactions.valueOf();
    const pinReact = [...allReactions.values()].find((r) =>
      emojisMatch(toEmojiObject(r.emoji), pinEmoji),
    );
    if (pinReact && pinReact.count === pinThreshold) {
      const res = await messagePinner(message, pinReact, user, client);
      if (res.sent) {
        incrementCounter("pinsLoggedTotal");
        const randomReply = await getRandomPinQuip();
        message.reply(randomReply);
        await announceMilestones(message, res.milestones);
      }
    }
  }

  // Classify this reaction's own emoji once, then run exactly one handler for it.
  const kind = classifyReactionEmoji(emojiObj, {
    pinEmoji,
    plusEmoji,
    minusEmoji,
    timeoutVoteEmoji,
    repostEmoji,
  });

  if (kind === "plus") {
    if (plusPlusEnabled && !isSelfReaction) {
      const milestones = await doplus(message.author.id, "user", user.id);
      await announceMilestones(message, milestones);
    }
  } else if (kind === "minus") {
    if (plusPlusEnabled && !isSelfReaction) {
      const milestones = await dominus(message.author.id, "user", user.id);
      await announceMilestones(message, milestones);
    }
  } else if (kind === "timeoutVote") {
    if (timeoutVoteEnabled && !isSelfReaction) {
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
  } else if (kind === "repost") {
    if (repostDetectionEnabled) {
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
  } else if (kind === "generic") {
    if (emojiTrackingEnabled) {
      let resolvedReaction = reaction;
      if (reaction.partial) {
        try {
          resolvedReaction = await reaction.fetch();
        } catch (err) {
          console.error(
            `bot: reactionHandler could not fetch a partial reaction (likely deleted before fetch completed) on message ${message.id} from user ${user.id}: ${api.describeApiError(err)}`,
          );
          resolvedReaction = null;
        }
      }
      const resolvedEmoji = resolvedReaction?.emoji ?? null;

      if (!resolvedEmoji) {
        // Fetch failed above; already logged.
      } else if (resolvedEmoji.id != null && !resolvedEmoji.guild) {
        // Custom emoji whose owning guild isn't one this bot is in (e.g. used via Nitro from
        // another server) — gracefully discard, don't track usage for an unknown guild's emoji.
        console.log(
          `bot: skipping emoji count for external/unknown-guild custom emoji ${resolvedEmoji.id} on message ${message.id} from user ${user.id}`,
        );
      } else {
        try {
          const milestones = await countEmoji(resolvedEmoji.name, resolvedEmoji.id, user.id);
          incrementCounter("emojiCountedTotal");
          await announceMilestones(message, milestones);
        } catch (err) {
          incrementCounter("apiCallErrorsTotal", "emojis");
          console.error(
            `bot: countEmoji failed for reaction emoji "${resolvedEmoji.id ?? resolvedEmoji.name}" on message ${message.id} from user ${user.id}: ${api.describeApiError(err)}`,
          );
        }
      }
    }
  }
  // kind === "pin": no further action here — the pin-threshold check above already ran,
  // independent of which reaction triggered this event.
}

/**
 * Handle messageReactionRemove: uncount repost, reverse plus/minus votes, un-count timeout votes.
 * @param {MessageReaction} reaction
 * @param {User} user
 * @param {{ plusEmoji: object|null, minusEmoji: object|null, repostEmoji: object|null, timeoutVoteEmoji: object|null, plusPlusEnabled: boolean, repostDetectionEnabled: boolean, timeoutVoteEnabled: boolean }} options - the *Emoji options are resolved emoji objects (see configStore.js), not bare strings.
 */
export async function handleReactionRemove(reaction, user, options) {
  const {
    plusEmoji,
    minusEmoji,
    repostEmoji,
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
  const isSelfReaction = user.id === message.author.id;

  const kind = classifyReactionEmoji(emojiObj, {
    plusEmoji,
    minusEmoji,
    timeoutVoteEmoji,
    repostEmoji,
  });

  if (kind === "repost") {
    if (repostDetectionEnabled) {
      uncountRepost(message.author.id, message.id, user.id).catch((err) => {
        console.error(
          `bot: uncountRepost failed for message ${message.id} (accused ${message.author.id}, accuser ${user.id}): ${api.describeApiError(err)}`,
        );
      });
    }
  } else if (kind === "plus") {
    if (plusPlusEnabled && !isSelfReaction) {
      const milestones = await dominus(message.author.id, "user", user.id);
      await announceMilestones(message, milestones);
    }
  } else if (kind === "minus") {
    if (plusPlusEnabled && !isSelfReaction) {
      const milestones = await doplus(message.author.id, "user", user.id);
      await announceMilestones(message, milestones);
    }
  } else if (kind === "timeoutVote") {
    if (timeoutVoteEnabled) {
      removeTimeoutVote(message.id, user.id).catch((err) => {
        incrementCounter("apiCallErrorsTotal", "timeoutVotes");
        console.error(
          `bot: removeTimeoutVote failed for message ${message.id} (voter ${user.id}): ${api.describeApiError(err)}`,
        );
      });
    }
  }
}
