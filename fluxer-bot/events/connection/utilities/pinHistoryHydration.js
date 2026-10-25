import { getPinChannelId, getPinEmoji } from "../../../configStore.js";
import { guildId } from "../../../configVars.js";
import { emojisMatch, toEmojiObject } from "../../../utilities/emojiCompare.js";
import {
  listIncompletePinHistory,
  updatePinHistoryRow,
} from "../../../api/pinHistory.js";

/**
 * Simplified port of discord-bot's pin-history hydration: no thread paging, no
 * embed-hint scraping, no attachment download (remote URLs passed through as-is).
 * See fluxer-bot/FEATURE_PARITY.md for why.
 */

/**
 * @param {import("@fluxerjs/core").Client} client
 * @param {string} channelId
 * @returns {Promise<string|null>}
 */
async function getChannelName(client, channelId) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  return channel?.name ? String(channel.name) : null;
}

/**
 * Text-capable channels to search: the guild's cached channels plus the configured
 * pin-log channel, if set.
 * @param {import("@fluxerjs/core").Client} client
 * @param {import("@fluxerjs/core").Guild} guild
 * @returns {Promise<import("@fluxerjs/core").Channel[]>}
 */
export async function collectSearchableChannels(client, guild) {
  const channels = [...guild.channels.values()].filter((c) =>
    c.isTextBased(),
  );
  const byId = new Map(channels.map((c) => [c.id, c]));

  const pinChannelId = getPinChannelId();
  if (pinChannelId && !byId.has(pinChannelId)) {
    try {
      const pinChannel = await client.channels.fetch(pinChannelId);
      if (pinChannel.isTextBased()) byId.set(pinChannel.id, pinChannel);
    } catch {}
  }

  return [...byId.values()];
}

/**
 * @param {import("@fluxerjs/core").Channel} channel
 * @param {string} msgid
 * @returns {Promise<import("@fluxerjs/core").Message|null>}
 */
async function tryFetchMessage(channel, msgid) {
  try {
    return await channel.messages.fetch(msgid);
  } catch {
    return null;
  }
}

/**
 * Locate a message by snowflake: try its known channel first, else brute-force the
 * collected channels.
 * @param {import("@fluxerjs/core").Client} client
 * @param {string} messageId
 * @param {string|null|undefined} knownChannelId
 * @param {import("@fluxerjs/core").Channel[]} channels
 * @returns {Promise<import("@fluxerjs/core").Message|null>}
 */
export async function findMessageById(
  client,
  messageId,
  knownChannelId,
  channels,
) {
  const msgid = String(messageId ?? "").trim();
  if (!msgid) return null;

  if (knownChannelId) {
    const channel = await client.channels
      .fetch(String(knownChannelId))
      .catch(() => null);
    const message = channel?.isTextBased()
      ? await tryFetchMessage(channel, msgid)
      : null;
    if (message) return message;
  }

  for (const channel of channels) {
    const message = await tryFetchMessage(channel, msgid);
    if (message) return message;
  }

  return null;
}

/**
 * Find the pin emoji reaction on a message (config value from pin_emoji).
 * @param {import("@fluxerjs/core").Message} message
 * @param {{app:string|null,emoid:string|null,emoji:string|null}|null} pinEmoji
 * @returns {import("@fluxerjs/core").MessageReaction|null}
 */
export function findPinReaction(message, pinEmoji) {
  if (!pinEmoji) return null;
  for (const reaction of message.reactions.cache.values()) {
    if (emojisMatch(toEmojiObject(reaction.emoji), pinEmoji)) return reaction;
  }
  return null;
}

/**
 * Collect user ids (non-bot) who reacted with the configured pin emoji.
 * @param {import("@fluxerjs/core").Message} message
 * @param {{app:string|null,emoid:string|null,emoji:string|null}|null} pinEmoji
 * @returns {Promise<string[]>}
 */
export async function getPinReactionUserIds(message, pinEmoji) {
  const pinReaction = findPinReaction(message, pinEmoji);
  if (!pinReaction) return [];

  const users = await message.fetchReactionUsers(pinReaction.emoji);
  return users.filter((user) => !user.bot).map((user) => user.id);
}

/**
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
    const totalCount = Number(total);
    if (
      entries.length === 0 ||
      offset >= (Number.isFinite(totalCount) ? totalCount : offset)
    ) {
      break;
    }
  }

  return rows;
}

/**
 * Hydrate one pin_history row from its source message.
 * @param {import("@fluxerjs/core").Client} client
 * @param {object} row - pin_history API row
 * @param {import("@fluxerjs/core").Channel[]} channels
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function hydratePinHistoryRow(client, row, channels) {
  const sourceMessage = await findMessageById(
    client,
    row.msgid,
    row.channelId,
    channels,
  );
  if (!sourceMessage) {
    return { ok: false, reason: "message not found in community" };
  }

  const pinEmoji = getPinEmoji();
  const pinnerUserIds = await getPinReactionUserIds(sourceMessage, pinEmoji);

  const channelId = String(sourceMessage.channelId);
  const channelName = await getChannelName(client, channelId);
  const contents = sourceMessage.content ? String(sourceMessage.content) : "";
  const attachmentUrls = [...sourceMessage.attachments.values()].map((a) =>
    String(a.url),
  );

  await updatePinHistoryRow(row.id, {
    app: "fluxer",
    authorId: sourceMessage.author?.id ?? null,
    contents,
    attachments: attachmentUrls,
    channelId,
    channelName,
    pinnerIds: pinnerUserIds,
    hydrated: true,
  });

  console.log(
    `pin-history hydration: hydrated row id=${row.id} msgid=${row.msgid} channel=${channelName ?? channelId} author=${sourceMessage.author?.id ?? "unknown"} pinners=${pinnerUserIds.length} attachments=${attachmentUrls.length}`,
  );

  return { ok: true };
}

/**
 * Backfill missing pin_history metadata from source messages.
 * @param {import("@fluxerjs/core").Client} client
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

  const guild = await client.guilds.resolve(guildId);
  const channels = await collectSearchableChannels(client, guild);

  console.log(
    `pin-history hydration: searching ${channels.length} channel(s)`,
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of incompleteRows) {
    try {
      const result = await hydratePinHistoryRow(client, row, channels);
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

  const summary = { total: incompleteRows.length, updated, skipped, failed };
  console.log("pin-history hydration complete:", summary);
  return summary;
}
