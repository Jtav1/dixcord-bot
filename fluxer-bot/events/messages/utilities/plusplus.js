import {
  plusplus,
  minusminus,
  recordPlusMinusFromMessage,
} from "../../../api/plusplus.js";

/**
 * Used by reaction handler only (user votes).
 * @returns {Promise<Array>} milestones newly achieved by this vote, if any
 */
export const doplus = async (string, typestr, voterid) => {
  if (typestr !== "user" || string === voterid) return [];
  try {
    return await plusplus(string, typestr, voterid);
  } catch (err) {
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
    return await minusminus(string, typestr, voterid);
  } catch (err) {
    console.log("bot: minusminus error", err);
    return [];
  }
};

/**
 * Pass message content to the API only if word++/user++ or word--/user-- detected in the message.
 * No unnecessary API call for messages lacking any ++/-- pattern; all parsing/decision logic
 * (mentions, word votes, self-vote skip, the bare-"++"/"--" reply case) happens in webapi via
 * recordPlusMinusFromMessage. This just supplies Fluxer-specific reply context.
 * @returns {Promise<Array>} milestones newly achieved by this call, if any
 */
export const plusMinusMsg = async (rawMessage) => {
  const plusMinusRegex = /\+\+|--/;

  if (typeof rawMessage.content !== "string") return [];
  if (!plusMinusRegex.test(rawMessage.content)) return [];

  // referencedMessage is already fully resolved on fluxer.js (unlike discord.js, which needs
  // an extra channel.messages.fetch() call) — no fetch needed here.
  const repliedAuthorId = rawMessage.referencedMessage?.author?.id ?? null;
  const isReply = repliedAuthorId != null;

  return recordPlusMinusFromMessage(rawMessage.content, rawMessage.author?.id, {
    isReply,
    repliedUserId: repliedAuthorId,
  });
};
