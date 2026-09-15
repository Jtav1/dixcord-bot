import {
  plusplus,
  minusminus,
  recordPlusMinusFromMessage,
} from "../../../api/plusplus.js";
import { incrementCounter } from "../../../utilities/metrics.js";

/**
 * Used by reaction handler only (user votes).
 * @returns {Promise<Array>} milestones newly achieved by this vote, if any
 */
export const doplus = async (string, typestr, voterid) => {
  if (typestr !== "user" || string === voterid) return [];
  try {
    const milestones = await plusplus(string, typestr, voterid);
    incrementCounter("plusplusVotesTotal");
    return milestones;
  } catch (err) {
    incrementCounter("apiCallErrorsTotal", "plusplus");
    console.log("bot: plusplus error", err);
    return [];
  }
};

/**
 * Used by reaction handler only (user votes).
 * @returns {Promise<Array>} milestones newly achieved by this vote, if any
 */
export const dominus = async (string, typestr, voterid) => {
  if (typestr !== "user" || string === voterid) return [];
  try {
    const milestones = await minusminus(string, typestr, voterid);
    incrementCounter("plusplusVotesTotal");
    return milestones;
  } catch (err) {
    incrementCounter("apiCallErrorsTotal", "plusplus");
    console.log("bot: minusminus error", err);
    return [];
  }
};

/**
 * Pass message content to the API only if word++/user++ or word--/user-- detected in the message.
 * No unnecessary API call for messages lacking any ++/-- pattern; all parsing/decision logic
 * (mentions, word votes, self-vote skip, the bare-"++"/"--" reply case) happens in webapi via
 * recordPlusMinusFromMessage. This just supplies Discord-specific reply context.
 * @returns {Promise<Array>} milestones newly achieved by this call, if any
 */
export const plusMinusMsg = async (rawMessage) => {
  const plusMinusRegex = /\+\+|--/;

  if (typeof rawMessage.content !== "string") return [];
  if (!plusMinusRegex.test(rawMessage.content)) return [];

  let isReply = false;
  let repliedUserId = null;

  if (
    rawMessage.reference &&
    rawMessage.reference.messageId &&
    rawMessage.channel &&
    typeof rawMessage.channel.messages?.fetch === "function"
  ) {
    try {
      const repliedMsg = await rawMessage.channel.messages.fetch(
        rawMessage.reference.messageId,
      );
      if (repliedMsg?.author?.id) {
        isReply = true;
        repliedUserId = repliedMsg.author.id;
      }
    } catch (err) {
      // Fallback to normal message parsing if the replied message can't be fetched.
      console.log("bot: plusMinusMsg could not fetch replied message", err);
    }
  }

  return recordPlusMinusFromMessage(rawMessage.content, rawMessage.author?.id, {
    isReply,
    repliedUserId,
  });
};
