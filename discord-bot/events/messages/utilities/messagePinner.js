import { EmbedBuilder } from "discord.js";
import * as api from "../api/client.js";

import { getAllConfigurations } from "../../../database/configurations.js";
import { isDev } from "../../../configVars.js";

const configs = await getAllConfigurations();
const filteredConfigs = configs.filter(
  (config_entry) => config_entry.config === "pin_channel_id",
);
const pinChannelId =
  filteredConfigs.length > 0
    ? filteredConfigs[0].value
    : isDev
      ? "710671234471559228"
      : "915462110761349201";

/**
 * Check whether a message was already logged as pinned.
 * POST /api/message-processing/pin-check with { messageId }.
 * @param {string} msgid - Message ID
 * @returns {Promise<boolean>}
 */
export const isMessageAlreadyPinned = async (msgid) => {
  if (!msgid) return false;
  const { data } = await api.post("/api/message-processing/pin-check", {
    messageId: msgid,
  });
  return Boolean(data?.alreadyPinned);
};

/**
 * Log a message as pinned (idempotent; API no-op if already logged).
 * POST /api/message-processing/pin-log with { messageId }.
 * @param {string} msgid - Message ID
 * @returns {Promise<void>}
 */
export const logPinnedMessage = async (msgid) => {
  if (!msgid) return;
  await api.post("/api/message-processing/pin-log", { messageId: msgid });
};

// messagePinner
// pins message if sufficent pin emoji reactions are added to it
// return: none/void
export const messagePinner = async (message, pinReaction, user, client) => {
  //check to see if the message is pinned already
  const isPinnedAlready = await isMessageAlreadyPinned(message.id);

  //if not, log that we're pinning this message
  if (!isPinnedAlready) {
    await logPinnedMessage(message.id);

    const users = await pinReaction.users.fetch();
    const userArray = [];

    users.each((user) => {
      userArray.push("<@" + user.id + ">");
    });

    const pinEmbed = new EmbedBuilder()
      .setColor(0xbc0302)
      .setAuthor({
        name: message.author.displayName + " (" + message.author.username + ")",
        iconURL: message.author.displayAvatarURL(),
        url: message.url,
      })
      .setTitle("📌 Major Pin Alert")
      .setURL(message.url)
      .addFields(
        {
          name: "Channel",
          value: "<#" + message.channelId + ">",
          inline: true,
        },
        { name: "Pinned by:", value: userArray.join(", "), inline: true },
      )
      .setTimestamp()
      .setFooter({ text: "Pinned by dixbot yell at Justin if it broke" });

    // For some reason the error uses >= 1 for null message so doing that instead of > 0
    message.content && message.content.length >= 1
      ? pinEmbed.setDescription(message.content)
      : null;

    message.attachments.forEach((attachment, key) => {
      pinEmbed.setImage(attachment.url);
    });

    //send embed message to the configured channel
    const channel = await client.channels.fetch(pinChannelId);
    await channel.send({ embeds: [pinEmbed] });

    return true;
  }

  return false;
};
