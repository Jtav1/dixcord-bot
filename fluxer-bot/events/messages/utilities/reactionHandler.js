import { describeApiError } from "../../../api/client.js";
import { countEmoji, countRepost, uncountRepost } from "../../../api/emojis.js";
import {
  recordTimeoutVote,
  removeTimeoutVote,
} from "../../../api/timeoutVotes.js";
import {
  getPinEmoji,
  getPinThreshold,
  getPlusEmoji,
  getMinusEmoji,
  getRepostEmoji,
  getTimeoutVoteEmoji,
  getTimeoutVoteDoubleRoleId,
  getTimeoutVoteTripleRoleId,
  isPinSystemEnabled,
  isPlusPlusEnabled,
  isEmojiTrackingEnabled,
  isRepostDetectionEnabled,
  isTimeoutVoteEnabled,
} from "../../../configStore.js";
import { emojisMatch, toEmojiObject } from "../../../utilities/emojiCompare.js";
import { announceMilestones } from "../../../utilities/milestoneNotifier.js";
import { incrementCounter } from "../../../utilities/metrics.js";
import { timeoutMember } from "../../../utilities/timeoutMember.js";
import { findPinReaction } from "../../connection/utilities/pinHistoryHydration.js";
import { doplus, dominus } from "./plusplus.js";
import { getRandomPinQuip, messagePinner } from "./messagePinner.js";

/**
 * Core reaction-handling logic, shared by the single-reaction and batched-add event wiring.
 * @typedef {{ message: import('@fluxerjs/core').Message, emoji: {id?:string,name:string,animated?:boolean}, userId: string, member: import('@fluxerjs/core').GuildMember|null, guildId: string|null, client: import('@fluxerjs/core').Client }} ReactionCtx
 */

/** Reads all reaction-feature config fresh, matching discord-bot's read-fresh-every-event convention. */
export function buildReactionOptions() {
  return {
    pinEmoji: getPinEmoji(),
    pinThreshold: getPinThreshold(),
    plusEmoji: getPlusEmoji(),
    minusEmoji: getMinusEmoji(),
    repostEmoji: getRepostEmoji(),
    timeoutVoteEmoji: getTimeoutVoteEmoji(),
    timeoutVoteDoubleRoleId: getTimeoutVoteDoubleRoleId(),
    timeoutVoteTripleRoleId: getTimeoutVoteTripleRoleId(),
    pinSystemEnabled: isPinSystemEnabled(),
    plusPlusEnabled: isPlusPlusEnabled(),
    emojiTrackingEnabled: isEmojiTrackingEnabled(),
    repostDetectionEnabled: isRepostDetectionEnabled(),
    timeoutVoteEnabled: isTimeoutVoteEnabled(),
  };
}

/**
 * Classify a reaction's emoji against the configured purpose-emojis, in fixed priority order.
 * @param {{id?:string,name:string}} emojiObj
 * @param {{pinEmoji?, plusEmoji?, minusEmoji?, timeoutVoteEmoji?, repostEmoji?}} options
 * @returns {"pin"|"plus"|"minus"|"timeoutVote"|"repost"|"generic"}
 */
function classifyReactionEmoji(emojiObj, options) {
  const emo = toEmojiObject(emojiObj);
  if (options.pinEmoji && emojisMatch(emo, options.pinEmoji)) return "pin";
  if (options.plusEmoji && emojisMatch(emo, options.plusEmoji)) return "plus";
  if (options.minusEmoji && emojisMatch(emo, options.minusEmoji))
    return "minus";
  if (options.timeoutVoteEmoji && emojisMatch(emo, options.timeoutVoteEmoji))
    return "timeoutVote";
  if (options.repostEmoji && emojisMatch(emo, options.repostEmoji))
    return "repost";
  return "generic";
}

/**
 * Vote weight based on the voter's roles: triple-role holders win over double-role holders.
 * @param {import('@fluxerjs/core').GuildMember|null} member
 * @param {string} doubleRoleId
 * @param {string} tripleRoleId
 * @returns {number}
 */
function resolveTimeoutVoteWeight(member, doubleRoleId, tripleRoleId) {
  if (!member) return 0;
  if (tripleRoleId && member.roles.has(tripleRoleId)) return 3;
  if (doubleRoleId && member.roles.has(doubleRoleId)) return 2;
  return 1;
}

async function handlePinCheck(ctx, options) {
  if (!options.pinSystemEnabled || !options.pinEmoji) return;
  const pinReact = findPinReaction(ctx.message, options.pinEmoji);
  if (!pinReact || pinReact.count !== options.pinThreshold) return;

  try {
    const res = await messagePinner(ctx.message, pinReact, ctx.client);
    if (!res.sent) return;
    incrementCounter("pinsLoggedTotal");
    getRandomPinQuip()
      .then((quip) => ctx.message.reply(quip))
      .catch(() => {});
    await announceMilestones(ctx.message, res.milestones);
  } catch (err) {
    incrementCounter("apiCallErrorsTotal", "pins");
    console.error(
      `bot: messagePinner failed for message ${ctx.message.id}: ${describeApiError(err)}`,
    );
  }
}

async function handleTimeoutVoteAdd(ctx, options) {
  // message.guildId is unreliable from reaction.fetchMessage(); ctx.guildId (gateway) is always set.
  const guild = ctx.guildId
    ? await ctx.client.guilds.resolve(ctx.guildId).catch(() => null)
    : null;
  const voterMember =
    ctx.member ?? (await guild?.members.resolve(ctx.userId).catch(() => null));
  const weight = resolveTimeoutVoteWeight(
    voterMember,
    options.timeoutVoteDoubleRoleId,
    options.timeoutVoteTripleRoleId,
  );

  let result;
  try {
    result = await recordTimeoutVote(
      ctx.message.id,
      ctx.message.author.id,
      ctx.userId,
      weight,
    );
  } catch (err) {
    incrementCounter("apiCallErrorsTotal", "timeoutVotes");
    console.error(
      `bot: recordTimeoutVote failed for message ${ctx.message.id}: ${describeApiError(err)}`,
    );
    return;
  }

  if (!result?.triggered) return;

  const targetMember =
    ctx.message.member ??
    (await guild?.members.resolve(ctx.message.author.id).catch(() => null));
  if (!targetMember) {
    console.error(
      `bot: timeout vote triggered for message ${ctx.message.id} but could not resolve target member ${ctx.message.author.id}; skipping timeout`,
    );
    return;
  }

  try {
    await timeoutMember(
      targetMember,
      result.durationSeconds,
      "Timed out by community vote",
    );
    const channel = ctx.message.channel ?? (await ctx.message.resolveChannel());
    await channel.send(
      String(result.responseMessage).replace(
        "{user}",
        `<@${ctx.message.author.id}>`,
      ),
    );
    incrementCounter("timeoutVotesTriggeredTotal");
  } catch (err) {
    incrementCounter("apiCallErrorsTotal", "timeoutVotes");
    console.error(
      `bot: timeoutMember failed for message ${ctx.message.id}: ${describeApiError(err)}`,
    );
  }
}

/**
 * @param {ReactionCtx} ctx
 * @param {ReturnType<typeof buildReactionOptions>} options
 * @returns {Promise<void>}
 */
export async function handleReactionAdd(ctx, options) {
  if (!ctx.message || !ctx.emoji) return;
  incrementCounter("reactionsProcessedTotal");

  const isSelfReaction = ctx.userId === ctx.message.author.id;

  await handlePinCheck(ctx, options);

  const kind = classifyReactionEmoji(ctx.emoji, options);

  if (kind === "plus") {
    if (!options.plusPlusEnabled || isSelfReaction) return;
    const milestones = await doplus(ctx.message.author.id, "user", ctx.userId);
    await announceMilestones(ctx.message, milestones);
  } else if (kind === "minus") {
    if (!options.plusPlusEnabled || isSelfReaction) return;
    const milestones = await dominus(ctx.message.author.id, "user", ctx.userId);
    await announceMilestones(ctx.message, milestones);
  } else if (kind === "timeoutVote") {
    if (!options.timeoutVoteEnabled || isSelfReaction) return;
    await handleTimeoutVoteAdd(ctx, options);
  } else if (kind === "repost") {
    if (!options.repostDetectionEnabled) return;
    countRepost(ctx.message.author.id, ctx.message.id, ctx.userId)
      .then((milestones) => {
        incrementCounter("repostsDetectedTotal");
        return announceMilestones(ctx.message, milestones);
      })
      .catch((err) => {
        incrementCounter("apiCallErrorsTotal", "reposts");
        console.error(
          `bot: countRepost failed for message ${ctx.message.id}: ${describeApiError(err)}`,
        );
      });
  } else if (kind === "generic") {
    if (!options.emojiTrackingEnabled) return;
    if (ctx.emoji.id != null) {
      // message.guildId is unreliable from reaction.fetchMessage(); ctx.guildId (gateway) is always set.
      const guild = ctx.guildId
        ? await ctx.client.guilds.resolve(ctx.guildId).catch(() => null)
        : null;
      if (!guild?.emojis.has(ctx.emoji.id)) {
        console.log(
          `bot: skipping reaction emoji count for external/unknown-guild custom emoji ${ctx.emoji.id} on message ${ctx.message.id}`,
        );
        return;
      }
    }
    try {
      const milestones = await countEmoji(
        ctx.emoji.name,
        ctx.emoji.id,
        ctx.userId,
      );
      incrementCounter("emojiCountedTotal");
      await announceMilestones(ctx.message, milestones);
    } catch (err) {
      incrementCounter("apiCallErrorsTotal", "emojis");
      console.error(
        `bot: countEmoji failed for reaction on message ${ctx.message.id}: ${describeApiError(err)}`,
      );
    }
  }
}

/**
 * @param {ReactionCtx} ctx
 * @param {ReturnType<typeof buildReactionOptions>} options
 * @returns {Promise<void>}
 */
export async function handleReactionRemove(ctx, options) {
  if (!ctx.message || !ctx.emoji) return;
  incrementCounter("reactionsProcessedTotal");

  const isSelfReaction = ctx.userId === ctx.message.author.id;

  // pinEmoji intentionally omitted: a pin can't be reversed by removing a reaction.
  const kind = classifyReactionEmoji(ctx.emoji, { ...options, pinEmoji: null });

  if (kind === "repost") {
    if (!options.repostDetectionEnabled) return;
    uncountRepost(ctx.message.author.id, ctx.message.id, ctx.userId).catch(
      (err) => {
        incrementCounter("apiCallErrorsTotal", "reposts");
        console.error(
          `bot: uncountRepost failed for message ${ctx.message.id}: ${describeApiError(err)}`,
        );
      },
    );
  } else if (kind === "plus") {
    // Removing a plus reverses it as a minus.
    if (!options.plusPlusEnabled || isSelfReaction) return;
    const milestones = await dominus(ctx.message.author.id, "user", ctx.userId);
    await announceMilestones(ctx.message, milestones);
  } else if (kind === "minus") {
    // Removing a minus reverses it as a plus.
    if (!options.plusPlusEnabled || isSelfReaction) return;
    const milestones = await doplus(ctx.message.author.id, "user", ctx.userId);
    await announceMilestones(ctx.message, milestones);
  } else if (kind === "timeoutVote") {
    // No self-check here, matching discord-bot's remove path exactly (deliberate parity choice,
    // not a bug to "fix" — see fluxer-bot/FEATURE_PARITY.md).
    if (!options.timeoutVoteEnabled) return;
    removeTimeoutVote(ctx.message.id, ctx.userId).catch((err) => {
      incrementCounter("apiCallErrorsTotal", "timeoutVotes");
      console.error(
        `bot: removeTimeoutVote failed for message ${ctx.message.id}: ${describeApiError(err)}`,
      );
    });
  }
}
