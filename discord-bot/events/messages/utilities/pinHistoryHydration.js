import { getPinEmoji } from "../../../configStore.js";
import { guildId } from "../../../configVars.js";
import {
  listIncompletePinHistory,
  updatePinHistoryRow,
} from "../../../api/pinHistory.js";
import {
  savePinAttachments,
  serializeAttachmentPaths,
} from "./pinAttachments.js";

/**
 * Resolve a channel display name for pin history (up to 100 chars).
 * @param {import("discord.js").Client} client
 * @param {string} channelId
 * @returns {Promise<string|null>}
 */
async function getChannelName(client, channelId) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.name) return null;
  return String(channel.name).slice(0, 100);
}

/**
 * Locate a Discord message by snowflake, using a known channel when available.
 * @param {import("discord.js").Client} client
 * @param {string} messageId
 * @param {string|null|undefined} knownChannelId
 * @returns {Promise<import("discord.js").Message|null>}
 */
export async function findMessageById(client, messageId, knownChannelId) {
  const msgid = String(messageId ?? "").trim();
  if (!msgid) return null;

  if (knownChannelId) {
    const channel = await client.channels.fetch(String(knownChannelId)).catch(() => null);
    if (channel?.isTextBased()) {
      try {
        return await channel.messages.fetch(msgid);
      } catch {
        // Fall through to guild search.
      }
    }
  }

  const guild = await client.guilds.fetch(guildId);
  const channels = await guild.channels.fetch();

  for (const channel of channels.values()) {
    if (!channel?.isTextBased()) continue;
    try {
      return await channel.messages.fetch(msgid);
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Find the pin emoji reaction on a message (config value from pin_emoji).
 * @param {import("discord.js").Message} message
 * @param {string|null} pinEmoji
 * @returns {import("discord.js").MessageReaction|null}
 */
export function findPinReaction(message, pinEmoji) {
  if (!pinEmoji) return null;

  const cached = message.reactions.cache.get(pinEmoji);
  if (cached) return cached;

  for (const reaction of message.reactions.cache.values()) {
    if (reaction.emoji.id === pinEmoji || reaction.emoji.name === pinEmoji) {
      return reaction;
    }
  }

  return null;
}

/**
 * Collect Discord user ids (non-bot) who reacted with the configured pin emoji.
 * @param {import("discord.js").Message} message
 * @param {string|null} pinEmoji
 * @returns {Promise<string[]>}
 */
export async function getPinReactionUserIds(message, pinEmoji) {
  if (!pinEmoji) return [];

  if (message.partial) {
    await message.fetch();
  }

  let pinReaction = findPinReaction(message, pinEmoji);
  if (!pinReaction && message.reactions.cache.size === 0) {
    try {
      await message.reactions.fetch();
      pinReaction = findPinReaction(message, pinEmoji);
    } catch (err) {
      console.warn(
        `pin-history hydration: could not fetch reactions for msgid=${message.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (!pinReaction) return [];

  const users = await pinReaction.users.fetch();
  const userIds = [];
  users.each((user) => {
    if (!user.bot) userIds.push(user.id);
  });
  return userIds;
}

/**
 * Fetch all incomplete pin_history rows from the web API.
 * @returns {Promise<object[]>}
 */
async function fetchAllIncompletePinRows() {
  const rows = [];
  const pageSize = 200;
  let offset = 0;

  for (;;) {
    const { entries, total } = await listIncompletePinHistory({
      limit: pageSize,
      offset,
    });
    rows.push(...entries);
    offset += entries.length;
    if (entries.length === 0 || offset >= total) break;
  }

  return rows;
}

/**
 * Hydrate one pin_history row from the Discord message referenced by msgid.
 * @param {import("discord.js").Client} client
 * @param {object} row - pin_history API row
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function hydratePinHistoryRow(client, row) {
  const sourceMessage = await findMessageById(
    client,
    row.msgid,
    row.channelId,
  );
  if (!sourceMessage) {
    return { ok: false, reason: "message not found in Discord guild" };
  }

  const pinEmoji = getPinEmoji();
  const pinnerUserIds = await getPinReactionUserIds(sourceMessage, pinEmoji);

  let attachmentPaths = [];
  if (sourceMessage.attachments.size > 0) {
    attachmentPaths = await savePinAttachments(
      sourceMessage.attachments,
      sourceMessage.id,
    );
  }

  const channelId = String(sourceMessage.channelId).slice(0, 32);
  const channelName = await getChannelName(client, channelId);
  const contents = sourceMessage.content
    ? String(sourceMessage.content).slice(0, 5000)
    : "";

  await updatePinHistoryRow(row.id, {
    app: "discord",
    authorId: sourceMessage.author?.id ?? null,
    contents,
    attachments:
      attachmentPaths.length > 0
        ? serializeAttachmentPaths(attachmentPaths)
        : "",
    channelId,
    channelName,
    pinnerIds: pinnerUserIds,
    hydrated: true,
  });

  console.log(
    `pin-history hydration: hydrated row id=${row.id} msgid=${row.msgid} channel=${channelName ?? channelId} author=${sourceMessage.author?.id ?? "unknown"} pinners=${pinnerUserIds.length} attachments=${attachmentPaths.length}`,
  );

  return { ok: true };
}

/**
 * Backfill missing pin_history metadata from Discord source messages.
 * @param {import("discord.js").Client} client
 * @returns {Promise<{ total: number, updated: number, skipped: number, failed: number }>}
 */
export async function hydratePinHistory(client) {
  const incompleteRows = await fetchAllIncompletePinRows();

  if (incompleteRows.length === 0) {
    console.log("pin-history hydration: no incomplete rows");
    return { total: 0, updated: 0, skipped: 0, failed: 0 };
  }

  console.log(
    `pin-history hydration: processing ${incompleteRows.length} incomplete row(s) …`,
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of incompleteRows) {
    try {
      const result = await hydratePinHistoryRow(client, row);
      if (result.ok) {
        updated += 1;
      } else {
        skipped += 1;
        console.warn(
          `pin-history hydration: skipped pin id=${row.id} msgid=${row.msgid}: ${result.reason}`,
        );
      }
    } catch (err) {
      failed += 1;
      console.error(
        `pin-history hydration: failed pin id=${row.id} msgid=${row.msgid}:`,
        err,
      );
    }
  }

  const summary = {
    total: incompleteRows.length,
    updated,
    skipped,
    failed,
  };
  console.log("pin-history hydration complete:", summary);
  return summary;
}
