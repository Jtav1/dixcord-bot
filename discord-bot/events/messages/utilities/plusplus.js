import {
  plusplus,
  minusminus,
  recordPlusMinusFromMessage,
} from "../../../api/plusplus.js";

/** Used by reaction handler only (user votes). */
export const doplus = async (string, typestr, voterid) => {
  if (typestr !== "user" || string === voterid) return;
  plusplus(string, typestr, voterid).catch((err) => {
    console.log("plusplus error", err);
  });
};

/** Used by reaction handler only (user votes). */
export const dominus = async (string, typestr, voterid) => {
  if (typestr !== "user" || string === voterid) return;
  minusminus(string, typestr, voterid).catch((err) => {
    console.log("minusminus error", err);
  });
};

/**
 * Pass message content to the API only if word++/user++ or word--/user-- detected in the message.
 * Parses for any instance of 'word++', 'word--', 'user++', 'user--' (allowing unicode/emoji-style words, not just alnum).
 * No unnecessary API call for messages lacking any ++/-- pattern.
 */
export const plusMinusMsg = async (rawMessage) => {
  // Regex for matching 'something++' or 'something--' (not preceded/followed by + or -)
  // Matches user mentions as well
  const plusMinusRegex =
    /^(?:\s*)?(\+\+|--)$|(?:<@!?\d+>|\S.*?)(\+\+|--)(?!\+|-)/g;

  if (typeof rawMessage.content !== "string") return;

  if (plusMinusRegex.test(rawMessage.content)) {
    // If this message is a reply to another message, and that replied message has an author,
    // use doplus/dominus for a user vote on the replied-to user instead of normal plusminus

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
        const targetUserId = repliedMsg?.author?.id;
        const voterId = rawMessage.author?.id;

        // Only if it's not self-voting and the replied message is not from a bot
        if (targetUserId && voterId && targetUserId !== voterId) {
          if (
            rawMessage.content.includes("++") &&
            rawMessage.content.length === 2
          ) {
            await doplus(targetUserId, "user", voterId);
          } else if (
            rawMessage.content.includes("--") &&
            rawMessage.content.length === 2
          ) {
            await dominus(targetUserId, "user", voterId);
          } else if (
            rawMessage.content.includes("++") ||
            rawMessage.content.includes("--")
          ) {
            await recordPlusMinusFromMessage(
              rawMessage.content,
              rawMessage.author?.id,
            );
          }
          return;
        }
      } catch (err) {
        // Fallback to normal message parsing if any error occurs fetching replied message
        console.warn("plusMinusMsg: Could not fetch replied message", err);
      }
    }

    // Default: record message content for plusminus parsing
    await recordPlusMinusFromMessage(rawMessage.content, rawMessage.author?.id);
  }
};
