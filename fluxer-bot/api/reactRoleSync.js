/**
 * React-for-role reconciliation: polls webapi for this guild's desired message state and makes
 * the live Fluxer message match it (post, edit in place, or delete), then reports success back.
 * Also caches the last-fetched message/bindings for reactionHandler.js to consult without its
 * own webapi round-trip per reaction. Mirrors discord-bot/api/reactRoleSync.js; see that file
 * for the shared design rationale.
 */

import { EmbedBuilder } from "@fluxerjs/builders";
import { client } from "../fluxerClient.js";
import {
  getReactRoleMessage,
  markReactRoleSynced,
  reportReactRoleSyncFailed,
  confirmReactRoleDelete,
} from "./reactRole.js";
import { isReactForRoleEnabled } from "../configStore.js";
import { guildId } from "../configVars.js";
import { emojisMatch, toEmojiObject } from "../utilities/emojiCompare.js";

// Short on purpose: an admin save should reach the live message within a couple of seconds, not
// wait out a long cache-refresh-style interval (see api/cacheRefresh.js's 30s, a different
// concern). The request itself is cheap (one webapi GET most ticks), so polling this often is fine.
const SYNC_INTERVAL_MS = 3_000;

/** @type {object|null} Last-fetched message+bindings (API shape), for reactionHandler.js. */
let cachedMessage = null;

/**
 * @returns {object|null} The cached react-for-role message (null if unconfigured or not yet polled).
 */
export function getCachedReactRoleMessage() {
  return cachedMessage;
}

/**
 * Convert a binding's stored raw emoji value into an object comparable via emojiCompare.js's
 * emojisMatch. A live reaction's emojiObj has emoid set to the custom emoji's id (or its name
 * for unicode emoji) — setting emoid to the same raw value here (it's either the id the admin
 * picked, or the literal unicode character) lines up with both cases.
 * @param {string} raw
 * @returns {{app:"fluxer", emoid:string, emoji:string}}
 */
export function toComparableEmoji(raw) {
  return { app: "fluxer", emoid: raw, emoji: raw };
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
 * @param {import("@fluxerjs/core").Guild} guild
 * @returns {string}
 */
function formatEmojiForDisplay(raw, guild) {
  if (!isSnowflake(raw)) return raw;
  const emoji = guild.emojis.get(raw);
  if (!emoji) return raw;
  return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
}

/**
 * Build the react-for-role embed: one field per binding, in sort order.
 * @param {object} message API-shape message (title, description, bindings).
 * @param {import("@fluxerjs/core").Guild} guild
 * @returns {EmbedBuilder}
 */
function buildEmbed(message, guild) {
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(message.title);
  if (message.description) embed.setDescription(message.description);
  for (const binding of message.bindings) {
    const role = guild.roles.get(binding.roleId);
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
 * Resolve a binding's stored raw emoji value into the EmojiInput shape fluxer.js's
 * `Message#react`/`removeReaction` expect: a plain string for unicode, or `{id, name, animated}`
 * for a custom emoji (looked up by id in the guild's emoji cache — a bare id string alone isn't
 * documented as accepted).
 * @param {string} raw
 * @param {import("@fluxerjs/core").Guild} guild
 * @returns {string|{id:string,name:string,animated:boolean}}
 */
function toEmojiInput(raw, guild) {
  if (!isSnowflake(raw)) return raw;
  const emoji = guild.emojis.get(raw);
  return emoji ? { id: emoji.id, name: emoji.name, animated: emoji.animated } : raw;
}

/**
 * React to the live message with each binding's emoji (so users can tap one without having to
 * look it up), and remove the bot's own reaction for any emoji no longer bound. Per-reaction
 * failures are logged and swallowed — a missing reaction is a UX nicety, not worth failing the
 * whole sync over. These reactions never trigger role logic themselves (reactionHandler.js's
 * role-react branches ignore the bot's own reactions).
 * @param {import("@fluxerjs/core").Message} liveMessage
 * @param {Array<{emoji:string}>} bindings
 * @param {import("@fluxerjs/core").Guild} guild
 * @returns {Promise<void>}
 */
async function syncBotReactions(liveMessage, bindings, guild) {
  for (const binding of bindings) {
    const alreadyReacted = [...liveMessage.reactions.cache.values()].some(
      (r) => r.me && emojisMatch(toEmojiObject(r.emoji), toComparableEmoji(binding.emoji)),
    );
    if (alreadyReacted) continue;
    try {
      await liveMessage.react(toEmojiInput(binding.emoji, guild));
    } catch (err) {
      console.error(
        `bot: failed to add react-role reaction ${binding.emoji} to message ${liveMessage.id}: ${err.message}`,
      );
    }
  }

  for (const reaction of liveMessage.reactions.cache.values()) {
    if (!reaction.me) continue;
    const stillBound = bindings.some((b) =>
      emojisMatch(toEmojiObject(reaction.emoji), toComparableEmoji(b.emoji)),
    );
    if (stillBound) continue;
    try {
      await liveMessage.removeReaction(toEmojiInput(reaction.emoji.id ?? reaction.emoji.name, guild));
    } catch (err) {
      console.error(
        `bot: failed to remove stale react-role reaction on message ${liveMessage.id}: ${err.message}`,
      );
    }
  }
}

/**
 * @param {unknown} err
 * @returns {boolean} True if this looks like "message not found" (already deleted/gone). The
 *   exact error shape for a missing message isn't confirmed against a live Fluxer instance
 *   (see FluxerAPIError/statusCode in @fluxerjs/rest) — checked both directly and via `.cause`,
 *   matching the one other statusCode check in this codebase (events/connection/ready.js).
 */
function isUnknownMessageError(err) {
  return err?.statusCode === 404 || err?.cause?.statusCode === 404;
}

/**
 * Delete the live message if one is recorded, treating "already gone" as success, then confirm.
 * @param {object} message
 * @returns {Promise<void>}
 */
async function handleDelete(message) {
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
 * then report the result back to webapi. Throws on any real failure (guild/channel not found,
 * missing permissions, etc.) — the caller (tick) reports those to webapi so the admin panel can
 * surface them. The one non-failure case — the live message was manually deleted — is handled
 * here by falling through to a fresh post, not thrown.
 * @param {object} message
 * @returns {Promise<void>}
 */
async function handlePostOrEdit(message) {
  const guild = client.guilds.get(guildId);
  if (!guild) throw new Error(`Guild ${guildId} not found in client cache`);
  const channel = await client.channels.fetch(message.channelId).catch(() => null);
  if (!channel) {
    throw new Error(`Channel ${message.channelId} not found or not accessible`);
  }
  const embed = buildEmbed(message, guild);

  if (message.messageId) {
    try {
      const liveMessage = await channel.messages.fetch(message.messageId);
      await liveMessage.edit({ embeds: [embed] });
      await syncBotReactions(liveMessage, message.bindings, guild);
      await markReactRoleSynced({
        messageId: message.messageId,
        channelId: message.channelId,
        syncedVersion: message.contentVersion,
      });
      return;
    } catch (err) {
      if (!isUnknownMessageError(err)) throw err;
      // Live message was manually deleted — fall through to repost fresh.
    }
  }

  const posted = await channel.send({ embeds: [embed] });
  await syncBotReactions(posted, message.bindings, guild);
  await markReactRoleSynced({
    messageId: posted.id,
    channelId: message.channelId,
    syncedVersion: message.contentVersion,
  });
}

/**
 * One reconciliation pass: refresh the cache, then act on pending delete or an out-of-sync edit.
 * pending_delete is checked before the enabled flag, so a delete already in flight completes
 * even if the feature gets disabled mid-flight. A post/edit failure is reported to webapi (so
 * the admin panel can surface it) rather than left to fail silently until the next tick retries.
 * @returns {Promise<void>}
 */
async function tick() {
  const message = await getReactRoleMessage();
  cachedMessage = message;
  if (!message) return;

  if (message.pendingDelete) {
    await handleDelete(message);
    return;
  }
  if (!isReactForRoleEnabled()) return;
  if (message.contentVersion === message.syncedVersion) return;

  try {
    await handlePostOrEdit(message);
  } catch (err) {
    console.error("bot: react-role post/edit failed:", err);
    await reportReactRoleSyncFailed({
      contentVersion: message.contentVersion,
      error: err?.message || String(err),
    }).catch((reportErr) => {
      console.error("bot: failed to report react-role sync failure:", reportErr);
    });
  }
}

/**
 * Start polling for react-for-role reconciliation. Runs once immediately, then on an interval.
 * @returns {void}
 */
export function startReactRoleSync() {
  const run = async () => {
    try {
      await tick();
    } catch (err) {
      console.error("bot: react-role sync error:", err);
    }
  };
  run();
  setInterval(run, SYNC_INTERVAL_MS);
}
