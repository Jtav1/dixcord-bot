import { ChannelType } from "discord.js";
import { getPinChannelId, getPinEmoji } from "../../../configStore.js";
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
 * @typedef {object} PinMessageSearchContext
 * @property {import("discord.js").TextBasedChannel[]} channels
 * @property {Map<string, string>} channelHints - msgid -> channelId from pin-channel embeds
 */

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
 * Collect text channels and threads the bot can search for a message.
 * @param {import("discord.js").Client} client
 * @param {import("discord.js").Guild} guild
 * @returns {Promise<import("discord.js").TextBasedChannel[]>}
 */
export async function collectSearchableChannels(client, guild) {
  await guild.channels.fetch();
  /** @type {Map<string, import("discord.js").TextBasedChannel>} */
  const byId = new Map();

  const add = (channel) => {
    if (channel?.isTextBased()) byId.set(channel.id, channel);
  };

  for (const channel of guild.channels.cache.values()) add(channel);

  try {
    const activeThreads = await guild.channels.fetchActiveThreads();
    for (const thread of activeThreads.threads.values()) add(thread);
  } catch (err) {
    console.warn(
      "pin-history hydration: could not fetch active threads:",
      err instanceof Error ? err.message : err,
    );
  }

  for (const channel of guild.channels.cache.values()) {
    if (
      channel.type !== ChannelType.GuildText &&
      channel.type !== ChannelType.GuildAnnouncement &&
      channel.type !== ChannelType.GuildForum
    ) {
      continue;
    }
    if (!("threads" in channel) || !channel.threads) continue;

    try {
      const active = await channel.threads.fetchActive();
      for (const thread of active.threads.values()) add(thread);
    } catch {}

    try {
      let before;
      for (let page = 0; page < 5; page++) {
        const archived = await channel.threads.fetchArchived({
          before,
          limit: 100,
        });
        for (const thread of archived.threads.values()) add(thread);
        if (!archived.hasMore) break;
        before = archived.threads.lastKey();
      }
    } catch {}
  }

  try {
    const pinChannel = await client.channels.fetch(getPinChannelId());
    add(pinChannel);
  } catch {}

  return [...byId.values()];
}

/**
 * Build msgid -> source channel hints by scanning pin-channel embed URLs.
 * @param {import("discord.js").Client} client
 * @returns {Promise<Map<string, string>>}
 */
export async function buildChannelHintsFromPinChannel(client) {
  /** @type {Map<string, string>} */
  const hints = new Map();
  let pinChannel;
  try {
    pinChannel = await client.channels.fetch(getPinChannelId());
  } catch {
    return hints;
  }
  if (!pinChannel?.isTextBased()) return hints;

  let lastId;
  let pages = 0;
  const maxPages = 30;

  for (;;) {
    const batch = await pinChannel.messages.fetch({
      limit: 100,
      before: lastId,
    });
    if (batch.size === 0) break;

    for (const message of batch.values()) {
      for (const embed of message.embeds) {
        const url = String(embed.url ?? "");
        const match = url.match(/\/channels\/\d+\/(\d+)\/(\d+)\/?$/);
        if (match) hints.set(match[2], match[1]);
      }
    }

    lastId = batch.last()?.id;
    pages += 1;
    if (batch.size < 100 || pages >= maxPages) break;
  }

  return hints;
}

/**
 * Try to fetch a message in one channel.
 * @param {import("discord.js").TextBasedChannel} channel
 * @param {string} msgid
 * @returns {Promise<import("discord.js").Message|null>}
 */
async function tryFetchMessage(channel, msgid) {
  try {
    return await channel.messages.fetch(msgid);
  } catch {
    return null;
  }
}

/**
 * Locate a Discord message by snowflake, using a known channel when available.
 * @param {import("discord.js").Client} client
 * @param {string} messageId
 * @param {string|null|undefined} knownChannelId
 * @param {PinMessageSearchContext} [searchContext]
 * @returns {Promise<import("discord.js").Message|null>}
 */
export async function findMessageById(
  client,
  messageId,
  knownChannelId,
  searchContext,
) {
  const msgid = String(messageId ?? "").trim();
  if (!msgid) return null;

  const hintedChannelId =
    knownChannelId ?? searchContext?.channelHints.get(msgid) ?? null;

  if (hintedChannelId) {
    const channel = await client.channels
      .fetch(String(hintedChannelId))
      .catch(() => null);
    const message = channel?.isTextBased()
      ? await tryFetchMessage(channel, msgid)
      : null;
    if (message) return message;
  }

  const channels =
    searchContext?.channels ??
    (await collectSearchableChannels(
      client,
      await client.guilds.fetch(guildId),
    ));

  for (const channel of channels) {
    const message = await tryFetchMessage(channel, msgid);
    if (message) return message;
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
    const totalCount = Number(total);
    if (entries.length === 0 || offset >= (Number.isFinite(totalCount) ? totalCount : offset)) {
      break;
    }
  }

  return rows;
}

/**
 * Hydrate one pin_history row from the Discord message referenced by msgid.
 * @param {import("discord.js").Client} client
 * @param {object} row - pin_history API row
 * @param {PinMessageSearchContext} searchContext
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function hydratePinHistoryRow(client, row, searchContext) {
  const sourceMessage = await findMessageById(
    client,
    row.msgid,
    row.channelId,
    searchContext,
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

  const guild = await client.guilds.fetch(guildId);
  const [channels, channelHints] = await Promise.all([
    collectSearchableChannels(client, guild),
    buildChannelHintsFromPinChannel(client),
  ]);
  const searchContext = { channels, channelHints };

  console.log(
    `pin-history hydration: searching ${channels.length} channel(s); ${channelHints.size} embed hint(s) from pin channel`,
  );

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of incompleteRows) {
    try {
      const result = await hydratePinHistoryRow(client, row, searchContext);
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
