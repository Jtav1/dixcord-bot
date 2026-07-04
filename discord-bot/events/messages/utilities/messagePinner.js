import { EmbedBuilder } from "discord.js";
import * as api from "../../../api/client.js";
import { getPinChannelId } from "../../../configStore.js";
import {
  savePinAttachments,
  serializeAttachmentPaths,
} from "./pinAttachments.js";

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
 * Build Discord mention strings for embed display.
 * @param {string[]} userIds
 * @returns {string[]}
 */
function pinnerMentionsFromUserIds(userIds) {
  return userIds.map((id) => `<@${id}>`);
}

/**
 * Resolve a channel display name for pin history (up to 100 chars).
 * @param {import("discord.js").Message["channel"]} channel
 * @returns {Promise<string|null>}
 */
async function getChannelNameForPin(channel) {
  if (!channel) return null;
  if (channel.name) return String(channel.name).slice(0, 100);
  if (typeof channel.fetch === "function") {
    const fetched = await channel.fetch().catch(() => null);
    if (fetched?.name) return String(fetched.name).slice(0, 100);
  }
  return null;
}

/**
 * Build the pin-log API payload from a Discord message.
 * @param {import("discord.js").Message} message
 * @param {string[]} attachmentPaths - Relative paths under `files/`
 * @param {string[]} pinnerUserIds - Discord user snowflakes
 * @param {string|null} channelName
 * @returns {object}
 */
function buildPinLogPayload(message, attachmentPaths, pinnerUserIds, channelName) {
  const contents = message.content ? String(message.content).slice(0, 5000) : null;
  const channelId = message.channelId ? String(message.channelId).slice(0, 32) : null;

  return {
    app: "discord",
    messageId: message.id,
    authorId: message.author?.id ?? null,
    contents: contents || null,
    attachments: serializeAttachmentPaths(attachmentPaths),
    channelId,
    channelName,
    pinnerIds: pinnerUserIds.filter(Boolean),
  };
}

/**
 * Log a message as pinned (idempotent; API no-op if already logged).
 * POST /api/message-processing/pin-log
 * @param {object} payload - Pin log fields (messageId required)
 * @returns {Promise<void>}
 */
export const logPinnedMessage = async (payload) => {
  if (!payload?.messageId) return;
  await api.post("/api/message-processing/pin-log", payload);
};

/**
 * Log + embed + send to pin channel (caller must ensure not already pinned).
 * @param {import("discord.js").Message} message
 * @param {import("discord.js").Client} client
 * @param {string[]} pinnerUserIds - Discord user snowflakes who pinned the message
 * @returns {Promise<true>}
 */
async function logAndSendPinEmbed(message, client, pinnerUserIds) {
  const attachmentPaths = await savePinAttachments(
    message.attachments,
    message.id,
  );
  const channelName = await getChannelNameForPin(message.channel);
  await logPinnedMessage(
    buildPinLogPayload(message, attachmentPaths, pinnerUserIds, channelName),
  );

  const pinnedByMentions = pinnerMentionsFromUserIds(pinnerUserIds);

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

  const channel = await client.channels.fetch(getPinChannelId());
  await channel.send({ embeds: [pinEmbed] });

  return true;
}

/**
 * Pin alert flow: skip if already logged, else log + embed to pin channel.
 * @param {import("discord.js").Message} message
 * @param {import("discord.js").Client} client
 * @param {string[]} pinnerUserIds - Discord user snowflakes who pinned the message
 * @returns {Promise<boolean>} true if alert was sent
 */
export async function sendPinAlert(message, client, pinnerUserIds) {
  if (await isMessageAlreadyPinned(message.id)) return false;
  return logAndSendPinEmbed(message, client, pinnerUserIds);
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
  const pinnerUserIds = [];

  users.each((u) => {
    if (!u.bot) pinnerUserIds.push(u.id);
  });

  return logAndSendPinEmbed(message, client, pinnerUserIds);
};
