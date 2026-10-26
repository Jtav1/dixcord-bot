import { Events } from "@fluxerjs/core";

import { client } from "../../fluxerClient.js";
import {
  buildReactionOptions,
  handleReactionRemove,
} from "./utilities/reactionHandler.js";

/**
 * @param {import('@fluxerjs/core').MessageReactionPayload} payload
 * @returns {Promise<import('@fluxerjs/core').Message|null>}
 */
async function resolveMessage(payload) {
  if (payload.message) return payload.message;
  try {
    return await payload.reaction.fetchMessage();
  } catch (err) {
    console.error(
      `bot: messageReactionRemove could not fetch message ${payload.messageId}:`,
      err,
    );
    return null;
  }
}

const execute = async (payload) => {
  // No top-level self-check: discord-bot applies self-checks only inside the plus/minus branches
  // on remove, not globally — mirrored in reactionHandler.js's handleReactionRemove.
  const message = await resolveMessage(payload);
  if (!message) return;
  await handleReactionRemove(
    {
      message,
      emoji: payload.emoji,
      userId: payload.userId,
      member: payload.member,
      client,
    },
    buildReactionOptions(),
  );
};

export const event = {
  name: Events.MessageReactionRemove,
  execute,
  once: false,
};
