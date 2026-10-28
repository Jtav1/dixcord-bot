import { EmbedBuilder } from "@fluxerjs/builders";

import * as api from "../../../api/client.js";
import { getPinChannelId } from "../../../configStore.js";
import { getPinReactionUserIds } from "../../connection/utilities/pinHistoryHydration.js";

/**
 * Live (reaction-triggered) pinning: pin-check/pin-log calls, pin quip, and the pin alert embed.
 * Simplified like pin-history hydration: no local attachment download, remote URLs passed through.
 */

/**
 * POST /api/message-processing/pin-check
 * @param {string} msgid
 * @returns {Promise<boolean>}
 */
export const isMessageAlreadyPinned = async (msgid) => {
  if (!msgid) return false;
  const { data } = await api.post("/api/message-processing/pin-check", {
    app: "fluxer",
    messageId: msgid,
  });
  return Boolean(data?.alreadyPinned);
};

/**
 * POST /api/message-processing/pin-log
 * @param {object} payload
 * @returns {Promise<Array>} milestones newly achieved, if any
 */
export const logPinnedMessage = async (payload) => {
  const { data } = await api.post("/api/message-processing/pin-log", payload);
  if (!data?.ok) throw new Error(data?.error || "Failed to log pinned message");
  return Array.isArray(data?.milestones) ? data.milestones : [];
};

/**
 * GET /api/pin-quips/random, falling back to a plain default on any failure.
 * @returns {Promise<string>}
 */
export async function getRandomPinQuip() {
  try {
    const { data } = await api.get("/api/pin-quips/random");
    if (data?.ok && data?.quip) return data.quip;
  } catch {
    // swallow - quip is cosmetic
  }
  return "PINNED";
}

/**
 * @param {import('@fluxerjs/core').Channel|null} channel
 * @returns {Promise<string|null>}
 */
async function getChannelNameForPin(channel) {
  if (!channel) return null;
  if (channel.name) return String(channel.name);
  const fetched = await channel.fetch?.().catch(() => null);
  return fetched?.name ? String(fetched.name) : null;
}

/**
 * Re-checks not-already-pinned, then logs and sends the pin alert embed.
 * @param {import('@fluxerjs/core').Message} message
 * @param {import('@fluxerjs/core').Client} client
 * @param {string[]} pinnerUserIds
 * @returns {Promise<{sent: boolean, milestones: Array}>}
 */
export async function sendPinAlert(message, client, pinnerUserIds) {
  if (await isMessageAlreadyPinned(message.id)) {
    return { sent: false, milestones: [] };
  }
  // message.channel is cache-only (null if uncached); resolveChannel() fetches it.
  const channel = message.channel ?? (await message.resolveChannel().catch(() => null));
  const channelName = await getChannelNameForPin(channel);
  const attachmentUrls = [...message.attachments.values()].map((a) =>
    String(a.url),
  );

  const milestones = await logPinnedMessage({
    app: "fluxer",
    messageId: message.id,
    authorId: message.author?.id ?? null,
    contents: message.content ? String(message.content) : null,
    attachments: attachmentUrls,
    channelId: String(message.channelId),
    channelName,
    pinnerIds: pinnerUserIds.filter(Boolean),
    guildId: message.guildId ?? null,
  });

  const embed = new EmbedBuilder()
    .setColor(0xbc0302)
    .setAuthor({
      name: `${message.author.displayName ?? message.author.username} (${message.author.username})`,
    })
    .setTitle("📌 Major Pin Alert")
    .addFields(
      { name: "Channel", value: `<#${message.channelId}>`, inline: true },
      {
        name: "Pinned by",
        value: pinnerUserIds.map((id) => `<@${id}>`).join(", ") || "unknown",
        inline: true,
      },
    )
    .setFooter({ text: "Pinned by dixbot" })
    .setTimestamp(new Date());
  if (message.content && message.content.length >= 1) {
    embed.setDescription(message.content);
  }
  if (attachmentUrls.length > 0) embed.setImage(attachmentUrls[0]);

  const pinChannel = await client.channels.fetch(getPinChannelId());
  await pinChannel.send({ embeds: [embed] });

  return { sent: true, milestones };
}

/**
 * Pin a message that just reached the configured pin threshold: re-checks not-already-pinned,
 * collects non-bot pinner ids, logs it, and sends the pin alert embed.
 * @param {import('@fluxerjs/core').Message} message
 * @param {import('@fluxerjs/core').MessageReaction} pinReaction
 * @param {import('@fluxerjs/core').Client} client
 * @returns {Promise<{sent: boolean, milestones: Array}>}
 */
export const messagePinner = async (message, pinReaction, client) => {
  const pinnerUserIds = await getPinReactionUserIds(message, {
    app: "fluxer",
    emoid: pinReaction.emoji.id ?? pinReaction.emoji.name,
    emoji: pinReaction.emoji.name,
  });
  return sendPinAlert(message, client, pinnerUserIds);
};
