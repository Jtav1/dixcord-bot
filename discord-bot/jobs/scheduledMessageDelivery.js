import {
  getDueScheduledMessages,
  markScheduledMessageSent,
} from "../api/scheduledMessages.js";

/** Max rows returned by GET /due per fetch (cache refresh). */
const DUE_FETCH_LIMIT = 100;

/** Last snapshot from GET /api/scheduled-messages/due (updated on query). */
let lastDueScheduledMessages = [];

/**
 * Milliseconds until the next clock-aligned minute (local time) where seconds and ms are 0.
 * @returns {number}
 */
export function msUntilNextMinuteMark() {
  const d = new Date();
  const sec = d.getSeconds();
  const ms = d.getMilliseconds();
  if (sec === 0 && ms === 0) return 0;
  return (60 - sec) * 1000 - ms;
}

/**
 * Fetches due scheduled messages from the API and refreshes the in-memory list.
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function queryDueScheduledMessages() {
  try {
    const { data } = await getDueScheduledMessages(DUE_FETCH_LIMIT);
    if (data?.ok && Array.isArray(data.messages)) {
      lastDueScheduledMessages = data.messages;
    } else {
      lastDueScheduledMessages = [];
    }
  } catch (err) {
    console.error("scheduled-messages: query due list error:", err);
    lastDueScheduledMessages = [];
  }
  return lastDueScheduledMessages;
}

/**
 * Snapshot of the last due list (after the most recent successful query).
 * @returns {ReadonlyArray<Record<string, unknown>>}
 */
export function getLastDueScheduledMessagesSnapshot() {
  return lastDueScheduledMessages;
}

/**
 * Posts Discord messages for each row in the last queried due list, then marks sent.
 * Re-queries the due list at the end so the cache matches the DB after PUTs.
 * @param {import('discord.js').Client} client
 */
export async function deliverDueScheduledMessages(client) {
  const rows = [...lastDueScheduledMessages];

  for (const row of rows) {
    const id = row.id;
    const channelId = row.discord_channel_id;
    const userId = row.discord_user_id;
    const body = String(row.message_body ?? "");

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased()) {
        console.warn(
          `scheduled-messages: channel ${channelId} not text-based; skipping id ${id}`,
        );
        continue;
      }

      const content = `<@${userId}> ${body}`.trim();
      await channel.send({
        content,
        allowedMentions: { users: [userId] },
      });

      const patch = await markScheduledMessageSent(id);
      if (!patch.data?.ok) {
        console.warn(
          `scheduled-messages: posted id ${id} but failed to mark sent`,
        );
      }
    } catch (err) {
      console.error(`scheduled-messages: failed id ${id}:`, err);
    }
  }

  await queryDueScheduledMessages();
}

/**
 * Refresh the due list from the API; optionally deliver and mark sent for any due rows.
 * Call after POST/DELETE (and after deliveries) so the bot’s cached list stays current.
 * @param {import('discord.js').Client} client
 * @param {{ deliver?: boolean }} [options] - default deliver true (POST creates); false after DELETE
 */
export async function syncScheduledMessagesDueFromApi(
  client,
  { deliver = true } = {},
) {
  await queryDueScheduledMessages();
  if (deliver) {
    await deliverDueScheduledMessages(client);
  }
}

/**
 * On startup: query due list, deliver, then schedule the same on each clock minute (:00).
 * @param {import('discord.js').Client} client
 */
export function startScheduledMessageDelivery(client) {
  const runMinuteWork = async () => {
    await queryDueScheduledMessages();
    await deliverDueScheduledMessages(client);
  };

  void runMinuteWork().catch((err) => {
    console.error("scheduled-messages: startup tick error:", err);
  });

  const scheduleNextAlignedMinute = () => {
    const delay = msUntilNextMinuteMark();
    setTimeout(async () => {
      try {
        await runMinuteWork();
      } catch (err) {
        console.error("scheduled-messages: aligned tick error:", err);
      }
      scheduleNextAlignedMinute();
    }, delay);
  };

  scheduleNextAlignedMinute();
}
