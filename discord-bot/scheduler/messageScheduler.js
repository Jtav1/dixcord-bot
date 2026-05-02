import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";
import {
  getPendingScheduledMessagesForBot,
  markScheduledMessageSent,
} from "../api/scheduledMessages.js";

let scheduler = null;
let dueMessagesJob = null;
let scheduledMessagesCache = [];
let discordClient = null;
let runInProgress = false;

/**
 * Normalize a datetime-like value to epoch ms, or null when invalid.
 * @param {unknown} value - Datetime input.
 * @returns {number|null} UTC timestamp in ms.
 */
function toEpochMs(value) {
  const d = new Date(String(value ?? ""));
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

/**
 * Refresh in-memory scheduled messages cache from webapi bot scope.
 * @returns {Promise<Array<object>>} Refreshed cache.
 */
export async function refreshScheduledMessagesCache() {
  const rows = await getPendingScheduledMessagesForBot();
  scheduledMessagesCache = Array.isArray(rows) ? rows : [];
  return scheduledMessagesCache;
}

/**
 * Read current scheduler cache.
 * @returns {Array<object>} Cached scheduled messages.
 */
export function getScheduledMessagesCache() {
  return scheduledMessagesCache;
}

/**
 * Process all currently due/past-due cached scheduled messages.
 * Sends messages and marks them sent in webapi.
 * @returns {Promise<number>} Number of messages successfully sent+marked.
 */
export async function processDueScheduledMessages() {
  if (!discordClient || runInProgress) return 0;
  runInProgress = true;
  try {
    const nowMs = Date.now();
    const dueRows = scheduledMessagesCache.filter((row) => {
      const scheduledMs = toEpochMs(row?.scheduled_at);
      return (
        scheduledMs != null &&
        scheduledMs <= nowMs &&
        String(row?.status ?? "") === "pending"
      );
    });

    let sentCount = 0;
    for (const row of dueRows) {
      try {
        const channel = await discordClient.channels.fetch(row.chat_channel_id);
        if (!channel || !channel.isTextBased()) continue;
        await channel.send(String(row.message_body ?? ""));
        const marked = await markScheduledMessageSent({
          id: row.id,
          sentAtUtcIso: new Date().toISOString(),
        });
        if (marked) sentCount++;
      } catch (err) {
        console.error(
          `scheduler: failed to send/mark scheduled message id=${row?.id}:`,
          err,
        );
      }
    }

    if (sentCount > 0) {
      await refreshScheduledMessagesCache();
    }
    return sentCount;
  } finally {
    runInProgress = false;
  }
}

/**
 * Start recurring scheduler job and perform initial cache load.
 * @param {import("discord.js").Client} client - Discord client instance.
 * @returns {Promise<void>}
 */
export async function startMessageScheduler(client) {
  discordClient = client;
  await refreshScheduledMessagesCache();

  if (!scheduler) scheduler = new ToadScheduler();
  if (dueMessagesJob) return;

  const task = new AsyncTask(
    "scheduled-messages-due-check",
    async () => {
      await processDueScheduledMessages();
    },
    (err) => {
      console.error("scheduler: recurring due check failed:", err);
    },
  );
  dueMessagesJob = new SimpleIntervalJob(
    { seconds: 15, runImmediately: false },
    task,
    { id: "scheduled-messages-due-check-job" },
  );
  scheduler.addSimpleIntervalJob(dueMessagesJob);
}

/**
 * Stop scheduler job and clear job state.
 * @returns {void}
 */
export function stopMessageScheduler() {
  if (scheduler && dueMessagesJob) {
    scheduler.removeById(dueMessagesJob.id);
    dueMessagesJob = null;
  }
}
