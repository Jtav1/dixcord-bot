import * as api from "./client.js";
import { guildId } from "../configVars.js";

/**
 * Record one reaction-add vote toward timing out a message's author.
 * POST /api/message-processing/timeout-vote
 * @param {string} messageId
 * @param {string} targetPlatformId - Author of the message being voted on
 * @param {string} voterPlatformId - User who reacted
 * @param {number} weight - Vote weight based on the voter's roles (1/2/3)
 * @returns {Promise<{ok:boolean, triggered?:boolean, alreadyActioned?:boolean, durationSeconds?:number, responseMessage?:string, voteWeightTotal?:number}>}
 */
export const recordTimeoutVote = async (
  messageId,
  targetPlatformId,
  voterPlatformId,
  weight,
) => {
  const { data } = await api.post("/api/message-processing/timeout-vote", {
    app: "fluxer",
    guildId,
    messageId,
    targetPlatformId,
    voterPlatformId,
    weight,
  });
  return data;
};

/**
 * Remove a voter's un-triggered vote. POST /api/message-processing/timeout-vote/remove
 * @param {string} messageId
 * @param {string} voterPlatformId
 * @returns {Promise<{ok:boolean, removed?:boolean}>}
 */
export const removeTimeoutVote = async (messageId, voterPlatformId) => {
  const { data } = await api.post(
    "/api/message-processing/timeout-vote/remove",
    { app: "fluxer", messageId, voterPlatformId },
  );
  return data;
};
