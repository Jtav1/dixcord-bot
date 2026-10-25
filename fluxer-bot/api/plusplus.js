import * as api from "./client.js";

/**
 * Record a plus vote from a reaction (user only). Calls API with type "reaction".
 * Message content (word++/user++) is handled by recordPlusMinusFromMessage; the webapi does that parsing.
 * @returns {Promise<Array>} milestones newly achieved by this vote, if any
 */
export const plusplus = async (string, typestr, voterid) => {
  if (typestr !== "user" || !string || !voterid || string === voterid) return [];
  const { data } = await api.post("/api/message-processing/plusminus", {
    app: "fluxer",
    type: "reaction",
    targetUserId: string,
    reactorId: voterid,
    value: 1,
  });
  return Array.isArray(data?.milestones) ? data.milestones : [];
};

/**
 * Record a minus vote from a reaction (user only). Calls API with type "reaction".
 * @returns {Promise<Array>} milestones newly achieved by this vote, if any
 */
export const minusminus = async (string, typestr, voterid) => {
  if (typestr !== "user" || !string || !voterid || string === voterid) return [];
  const { data } = await api.post("/api/message-processing/plusminus", {
    app: "fluxer",
    type: "reaction",
    targetUserId: string,
    reactorId: voterid,
    value: -1,
  });
  return Array.isArray(data?.milestones) ? data.milestones : [];
};

/**
 * Send message content to the API for plus/minus parsing. The webapi (recordPlusMinusMessage)
 * does all parsing: word++/user++/--, filter list, self-vote skip. No parsing in the bot.
 * @param {string} messageContent - Raw message content
 * @param {string} voterId - Author's user id
 * @param {{ isReply?: boolean, repliedUserId?: string|null }} [replyContext] - Reply metadata, for
 *   a reply message that's just "++"/"--" with no word/mention for the webapi parser to match.
 * @returns {Promise<Array>} milestones newly achieved by this call, if any
 */
export const recordPlusMinusFromMessage = async (
  messageContent,
  voterId,
  replyContext = {},
) => {
  if (!voterId) return [];
  const { data } = await api.post("/api/message-processing/plusminus", {
    app: "fluxer",
    type: "message",
    message: { content: messageContent ?? "", author: { id: voterId } },
    voterId,
    isReply: Boolean(replyContext.isReply),
    repliedUserId: replyContext.repliedUserId ?? null,
  });
  return Array.isArray(data?.milestones) ? data.milestones : [];
};
