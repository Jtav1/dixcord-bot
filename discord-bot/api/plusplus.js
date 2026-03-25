import * as api from "./client.js";

/**
 * Record a plus vote from a reaction (user only). Calls API with type "reaction".
 * Message content (word++/user++) is handled by recordPlusMinusFromMessage; the webapi does that parsing.
 */
export const plusplus = async (string, typestr, voterid) => {
  if (typestr !== "user" || !string || !voterid || string === voterid) return;
  await api.post("/api/message-processing/plusminus", {
    app: "discord",
    type: "reaction",
    targetUserId: string,
    reactorId: voterid,
    value: 1,
  });
};

/**
 * Record a minus vote from a reaction (user only). Calls API with type "reaction".
 */
export const minusminus = async (string, typestr, voterid) => {
  if (typestr !== "user" || !string || !voterid || string === voterid) return;
  await api.post("/api/message-processing/plusminus", {
    app: "discord",
    type: "reaction",
    targetUserId: string,
    reactorId: voterid,
    value: -1,
  });
};

/**
 * Send message content to the API for plus/minus parsing. The webapi (recordPlusMinusMessage)
 * does all parsing: word++/user++/--, filter list, self-vote skip. No parsing in the bot.
 * @param {string} messageContent - Raw message content
 * @param {string} voterId - Author's user id
 */
export const recordPlusMinusFromMessage = async (messageContent, voterId) => {
  if (!voterId) return;
  await api.post("/api/message-processing/plusminus", {
    app: "discord",
    type: "message",
    message: { content: messageContent ?? "", author: { id: voterId } },
    voterId,
  });
};

/**
 * Total score for a string (word or user). GET /api/leaderboards/plusplus/total
 * @returns {Promise<Array<{ total: number }>>} For backward compat with callers that use result[0].total
 */
export const getTotalScoreByString = async (string, typestr) => {
  if (!string) return [{ total: 0 }];
  const type = typestr === "user" ? "user" : "word";
  const { data } = await api.get("/api/leaderboards/plusplus/total", {
    params: { app: "discord", string, type },
  });
  if (!data?.ok) return [{ total: 0 }];
  return [{ total: Number(data.total) ?? 0 }];
};

/**
 * Top plusplus scores. POST /api/leaderboards/plusplus
 * @returns {Promise<Array<{ string: string, typestr: string, total: number }>>}
 */
export const getTopScores = async (number = 5) => {
  const { data } = await api.post("/api/leaderboards/plusplus", {
    app: "discord",
    limit: number,
  });
  if (!data?.ok || !Array.isArray(data.top)) return [];
  return data.top;
};

/**
 * Bottom plusplus scores. POST /api/leaderboards/plusplus
 * @returns {Promise<Array<{ string: string, typestr: string, total: number }>>}
 */
export const getBottomScores = async (number = 5) => {
  const { data } = await api.post("/api/leaderboards/plusplus", {
    app: "discord",
    limit: number,
  });
  if (!data?.ok || !Array.isArray(data.bottom)) return [];
  return data.bottom;
};

/**
 * Number of votes cast by a voter. GET /api/leaderboards/plusplus/voter/:userId
 * @returns {Promise<Array<{ total: number }>>} For backward compat with callers that use result[0].total
 */
export const getVotesById = async (voterid) => {
  if (!voterid) return [{ total: 0 }];
  const { data } = await api.get(`/api/leaderboards/plusplus/voter/${voterid}`, {
    params: { app: "discord" },
  });
  if (!data?.ok) return [{ total: 0 }];
  return [{ total: Number(data.total) ?? 0 }];
};

/**
 * Top voters by vote count. POST /api/leaderboards/plusplus/top-voters
 * @returns {Promise<Array<{ voter: string, total: number }>>}
 */
export const getTopVoters = async (number = 3) => {
  const { data } = await api.post("/api/leaderboards/plusplus/top-voters", {
    app: "discord",
    limit: number,
  });
  if (!data?.ok || !Array.isArray(data.topVoters)) return [];
  return data.topVoters;
};
