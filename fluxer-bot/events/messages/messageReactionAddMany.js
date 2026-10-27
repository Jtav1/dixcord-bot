import { Events } from "@fluxerjs/core";

import { client } from "../../fluxerClient.js";
import {
  buildReactionOptions,
  handleReactionAdd,
} from "./utilities/reactionHandler.js";

/**
 * Gateway may batch rapid reactions here instead of individual MessageReactionAdd events.
 * @param {import('@fluxerjs/core').MessageReactionAddManyPayload} payload
 */
const execute = async (payload) => {
  if (!payload.message) return;

  // Sequential, not Promise.all: avoids concurrent webapi insert-if-missing races on the same
  // message/emoji, same rationale as emojiDetector.js/stickerDetector.js.
  for (const entry of payload.reactions) {
    if (entry.userId === client.user?.id) continue;
    await handleReactionAdd(
      {
        message: payload.message,
        emoji: entry.emoji,
        userId: entry.userId,
        member: entry.member,
        client,
      },
      buildReactionOptions(),
    );
  }
};

export const event = {
  name: Events.MessageReactionAddMany,
  execute,
  once: false,
};
