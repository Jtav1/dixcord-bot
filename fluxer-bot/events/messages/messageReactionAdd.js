import { Events } from "@fluxerjs/core";

import { client } from "../../fluxerClient.js";
import {
  buildReactionOptions,
  handleReactionAdd,
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
      `bot: messageReactionAdd could not fetch message ${payload.messageId}:`,
      err,
    );
    return null;
  }
}

const execute = async (payload) => {
  if (payload.userId === client.user?.id) return;
  const message = await resolveMessage(payload);
  if (!message) return;
  await handleReactionAdd(
    {
      message,
      emoji: payload.emoji,
      userId: payload.userId,
      member: payload.member,
      // message.guildId is unreliable from reaction.fetchMessage(); reaction.guildId is always set.
      guildId: payload.reaction.guildId,
      client,
    },
    buildReactionOptions(),
  );
};

export const event = { name: Events.MessageReactionAdd, execute, once: false };
