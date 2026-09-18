import * as api from "./client.js";
import { guildId } from "../configVars.js";

/**
 * Record one reaction-add vote toward timing out a message's author.
 * POST /api/message-processing/timeout-vote
 * @param {string} messageId - Discord message snowflake.
 * @param {string} targetPlatformId - Discord snowflake of the message author.
 * @param {string} voterPlatformId - Discord snowflake of the user who reacted.
 * @param {number} weight - Vote weight based on the voter's roles (1/2/3).
 * @returns {Promise<{ ok: boolean, triggered: boolean, alreadyActioned?: boolean, durationSeconds?: number, responseMessage?: string, voteWeightTotal?: number }>}
 */
export const recordTimeoutVote = async (messageId, targetPlatformId, voterPlatformId, weight) => {
  const { data } = await api.post("/api/message-processing/timeout-vote", {
    app: "discord",
    guildId,
    messageId,
    targetPlatformId,
    voterPlatformId,
    weight,
  });
  return data;
};

/**
 * Un-count a reaction-remove vote.
 * POST /api/message-processing/timeout-vote/remove
 * @param {string} messageId - Discord message snowflake.
 * @param {string} voterPlatformId - Discord snowflake of the user who un-reacted.
 * @returns {Promise<{ ok: boolean, removed: boolean }>}
 */
export const removeTimeoutVote = async (messageId, voterPlatformId) => {
  const { data } = await api.post("/api/message-processing/timeout-vote/remove", {
    app: "discord",
    messageId,
    voterPlatformId,
  });
  return data;
};
