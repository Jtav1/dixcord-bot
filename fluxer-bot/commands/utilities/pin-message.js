import { PermissionFlags } from "@fluxerjs/core";

import { sendPinAlert, getRandomPinQuip } from "../../events/messages/utilities/messagePinner.js";
import {
  findPinReaction,
  getPinReactionUserIds,
  collectSearchableChannels,
  findMessageById,
} from "../../events/connection/utilities/pinHistoryHydration.js";
import { announceMilestones } from "../../utilities/milestoneNotifier.js";
import { getPinEmoji } from "../../configStore.js";
import { guildId } from "../../configVars.js";
import { sendUsageError } from "../../utilities/commandHelpers.js";

const cmdName = "pin-message";
const featureKey = "pin_system_enabled";

const data = {
  description: "Send the pin alert for a message by id (works from any channel or DM)",
  usage: "pin-message <message_id>",
};

/**
 * Member permission checks are guild-only; usable from any guild channel regardless of where
 * the target message lives, and from DMs (resolves the member via the bot's configured guild).
 */
const execute = async (message, args) => {
  const guild = await message.client.guilds.resolve(guildId).catch(() => null);
  const member =
    message.member ?? (await guild?.members.resolve(message.author.id).catch(() => null));
  if (!member?.permissions.has(PermissionFlags.Administrator)) {
    await message.author.send("You don't have permission to use this command.").catch(() => null);
    return;
  }

  const messageId = args[0]?.trim();
  if (!messageId || !/^\d{17,20}$/.test(messageId)) {
    await sendUsageError(message, { cmdName, data });
    return;
  }

  const channels = guild ? await collectSearchableChannels(message.client, guild) : [];
  const targetMessage = await findMessageById(
    message.client,
    messageId,
    message.guildId ? message.channelId : null,
    channels,
  );
  if (!targetMessage) {
    await message.author
      .send("No message with that id was found in the server.")
      .catch(() => null);
    return;
  }

  const pinnerIds = new Set([message.author.id]);
  const pinEmoji = getPinEmoji();
  if (pinEmoji && findPinReaction(targetMessage, pinEmoji)) {
    for (const id of await getPinReactionUserIds(targetMessage, pinEmoji)) pinnerIds.add(id);
  }

  const result = await sendPinAlert(targetMessage, message.client, [...pinnerIds]);

  if (result.sent) {
    const quip = await getRandomPinQuip();
    await targetMessage.reply(quip);
    await announceMilestones(targetMessage, result.milestones);
    await message.author.send("Pin alert sent for that message.").catch(() => null);
  } else {
    await message.author
      .send("That message was already logged as pinned; nothing to do.")
      .catch(() => null);
  }
};

export { cmdName, data, execute, featureKey };
