/**
 * React-for-role reconciliation: polls webapi for this guild's desired message state and makes
 * the live Discord message match it (post, edit in place, or delete), then reports success back.
 * Also caches the last-fetched message/bindings for reactionHandler.js to consult without its
 * own webapi round-trip per reaction.
 */

import { EmbedBuilder } from "discord.js";
import { getReactRoleMessage, markReactRoleSynced, confirmReactRoleDelete } from "./reactRole.js";
import { isReactForRoleEnabled } from "../configStore.js";
import { guildId } from "../configVars.js";

const SYNC_INTERVAL_MS = 30_000;

/** Discord's "Unknown Message" API error code. */
const UNKNOWN_MESSAGE_CODE = 10008;

/** @type {object|null} Last-fetched message+bindings (API shape), for reactionHandler.js. */
let cachedMessage = null;

/** @type {import("discord.js").Client|null} */
let syncClient = null;

/**
 * @returns {object|null} The cached react-for-role message (null if unconfigured or not yet polled).
 */
export function getCachedReactRoleMessage() {
  return cachedMessage;
}

/**
 * Convert a binding's stored raw emoji value into an object comparable via emojiCompare.js's
 * emojisMatch. A live reaction's emojiObj always has app "discord" with emoid set to the custom
 * emoji's id (or its name for unicode emoji) — setting emoid to the same raw value here (it's
 * either the id the admin picked, or the literal unicode character) lines up with both cases.
 * @param {string} raw
 * @returns {{app:"discord", emoid:string, emoji:string}}
 */
export function toComparableEmoji(raw) {
  return { app: "discord", emoid: raw, emoji: raw };
}

/**
 * @param {string} raw A binding's stored emoji value: either a custom emoji's snowflake id, or a
 *   literal unicode emoji character typed by the admin.
 * @returns {boolean}
 */
function isSnowflake(raw) {
  return /^\d{17,20}$/.test(raw);
}

/**
 * Render a binding's stored emoji value for use in embed text.
 * @param {string} raw
 * @param {import("discord.js").Guild} guild
 * @returns {string}
 */
function formatEmojiForDisplay(raw, guild) {
  if (!isSnowflake(raw)) return raw;
  const emoji = guild.emojis.cache.get(raw);
  if (!emoji) return raw;
  return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
}

/**
 * Build the react-for-role embed: one field per binding, in sort order.
 * @param {object} message API-shape message (title, description, bindings).
 * @param {import("discord.js").Guild} guild
 * @returns {EmbedBuilder}
 */
function buildEmbed(message, guild) {
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(message.title);
  if (message.description) embed.setDescription(message.description);
  for (const binding of message.bindings) {
    const role = guild.roles.cache.get(binding.roleId);
    const roleName = role ? role.name : `(deleted role ${binding.roleId})`;
    embed.addFields({
      name: `${formatEmojiForDisplay(binding.emoji, guild)}  ${roleName}`,
      value: binding.description,
      inline: false,
    });
  }
  return embed;
}

/**
 * @param {unknown} err
 * @returns {boolean} True if this is discord.js's "Unknown Message" error (already deleted/gone).
 */
function isUnknownMessageError(err) {
  return err?.code === UNKNOWN_MESSAGE_CODE;
}

/**
 * Delete the live message if one is recorded, treating "already gone" as success, then confirm.
 * @param {import("discord.js").Client} client
 * @param {object} message
 * @returns {Promise<void>}
 */
async function handleDelete(client, message) {
  if (message.messageId) {
    try {
      const channel = await client.channels.fetch(message.channelId).catch(() => null);
      const liveMessage = await channel?.messages.fetch(message.messageId);
      await liveMessage?.delete();
    } catch (err) {
      if (!isUnknownMessageError(err)) {
        console.error("bot: react-role delete failed, will retry next sync:", err);
        return;
      }
    }
  }
  await confirmReactRoleDelete();
}

/**
 * Post a new message or edit the existing one in place to match `message`'s current content,
 * then report the result back to webapi.
 * @param {import("discord.js").Client} client
 * @param {object} message
 * @returns {Promise<void>}
 */
async function handlePostOrEdit(client, message) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  const channel = await client.channels.fetch(message.channelId).catch(() => null);
  if (!channel) {
    console.error(`bot: react-role channel ${message.channelId} not found; will retry next sync`);
    return;
  }
  const embed = buildEmbed(message, guild);

  if (message.messageId) {
    try {
      const liveMessage = await channel.messages.fetch(message.messageId);
      await liveMessage.edit({ embeds: [embed] });
      await markReactRoleSynced({
        messageId: message.messageId,
        channelId: message.channelId,
        syncedVersion: message.contentVersion,
      });
      return;
    } catch (err) {
      if (!isUnknownMessageError(err)) {
        console.error("bot: react-role edit failed, will retry next sync:", err);
        return;
      }
      // Live message was manually deleted — fall through to repost fresh.
    }
  }

  const posted = await channel.send({ embeds: [embed] });
  await markReactRoleSynced({
    messageId: posted.id,
    channelId: message.channelId,
    syncedVersion: message.contentVersion,
  });
}

/**
 * One reconciliation pass: refresh the cache, then act on pending delete or an out-of-sync edit.
 * pending_delete is checked before the enabled flag, so a delete already in flight completes
 * even if the feature gets disabled mid-flight.
 * @param {import("discord.js").Client} client
 * @returns {Promise<void>}
 */
async function tick(client) {
  const message = await getReactRoleMessage();
  cachedMessage = message;
  if (!message) return;

  if (message.pendingDelete) {
    await handleDelete(client, message);
    return;
  }
  if (!isReactForRoleEnabled()) return;
  if (message.contentVersion === message.syncedVersion) return;
  await handlePostOrEdit(client, message);
}

/**
 * Start polling for react-for-role reconciliation. Runs once immediately, then on an interval.
 * @param {import("discord.js").Client} client
 * @returns {void}
 */
export function startReactRoleSync(client) {
  syncClient = client;
  const run = async () => {
    try {
      await tick(syncClient);
    } catch (err) {
      console.error("bot: react-role sync error:", err);
    }
  };
  run();
  setInterval(run, SYNC_INTERVAL_MS);
}
