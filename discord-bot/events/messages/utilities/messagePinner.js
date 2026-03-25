import { EmbedBuilder } from "discord.js";
import * as api from "../../../api/client.js";

import { getAllConfigurations } from "../../../api/configurations.js";

const configs = await getAllConfigurations();
const filteredConfigs = configs.filter(
  (config_entry) => config_entry.config === "pin_channel_id",
);

if (filteredConfigs.length === 0 || !filteredConfigs[0].value) {
  throw new Error("pin_channel_id configuration not found or has empty value.");
}

const pinChannelId = filteredConfigs[0].value;

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

/**
 * Log + embed + send to pin channel (caller must ensure not already pinned).
 * @param {import("discord.js").Message} message
 * @param {import("discord.js").Client} client
 * @param {string[]} pinnedByMentions - e.g. ["<@id>", ...]
 * @returns {Promise<true>}
 */
async function logAndSendPinEmbed(message, client, pinnedByMentions) {
  await logPinnedMessage(message.id);

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
      { name: "Pinned by:", value: pinnedByMentions.join(", "), inline: true },
    )
    .setTimestamp()
    .setFooter({ text: "Pinned by dixbot" });

  // For some reason the error uses >= 1 for null message so doing that instead of > 0
  message.content && message.content.length >= 1
    ? pinEmbed.setDescription(message.content)
    : null;

  message.attachments.forEach((attachment, key) => {
    pinEmbed.setImage(attachment.url);
  });

  const channel = await client.channels.fetch(pinChannelId);
  await channel.send({ embeds: [pinEmbed] });

  return true;
}

/**
 * Pin alert flow: skip if already logged, else log + embed to pin channel.
 * @param {import("discord.js").Message} message
 * @param {import("discord.js").Client} client
 * @param {string[]} pinnedByMentions
 * @returns {Promise<boolean>} true if alert was sent
 */
export async function sendPinAlert(message, client, pinnedByMentions) {
  if (await isMessageAlreadyPinned(message.id)) return false;
  return logAndSendPinEmbed(message, client, pinnedByMentions);
}

/**
 * pin message if sufficent pin emoji reactions are added to it
 * POST /api/message-processing/pin-log with { messageId }.
 * @param {string} message
 * @param {object} pinReaction
 * @param {object} user
 * @param {object} client
 * @returns {boolean} false (can ignore)
 */
export const messagePinner = async (message, pinReaction, user, client) => {
  if (await isMessageAlreadyPinned(message.id)) return false;

  const users = await pinReaction.users.fetch();
  const userArray = [];

  users.each((u) => {
    userArray.push("<@" + u.id + ">");
  });

  return logAndSendPinEmbed(message, client, userArray);
};
