import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";
import {
  getDueScheduledMessagesForBot,
  markScheduledMessageSent,
} from "../api/scheduledMessages.js";

let scheduler = null;
let dueMessagesJob = null;
let discordClient = null;
let runInProgress = false;

/**
 * Send and mark-sent every scheduled message webapi currently considers due
 * (scheduled_at <= now); webapi does the due-time comparison.
 * @returns {Promise<number>} Number of messages successfully sent+marked.
 */
export async function processDueScheduledMessages() {
  if (!discordClient || runInProgress) return 0;
  runInProgress = true;
  try {
    const dueRows = await getDueScheduledMessagesForBot();

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

    return sentCount;
  } finally {
    runInProgress = false;
  }
}

/**
 * Start recurring scheduler job.
 * @param {import("discord.js").Client} client - Discord client instance.
 * @returns {Promise<void>}
 */
export async function startMessageScheduler(client) {
  discordClient = client;

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
