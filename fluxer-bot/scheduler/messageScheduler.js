/**
 * Delivers due scheduled reminders (created via @bot remind me ...) to their channel.
 * Due-time comparison happens server-side; this just sends whatever webapi reports as due.
 */

import { client } from "../fluxerClient.js";
import {
  getDueScheduledMessagesForBot,
  markScheduledMessageSent,
} from "../api/scheduledMessages.js";

const POLL_INTERVAL_MS = 15_000;

let runInProgress = false;
let schedulerHandle = null;

/**
 * Send every currently-due scheduled message and mark it sent. Best-effort per row.
 * @returns {Promise<void>}
 */
export async function processDueScheduledMessages() {
  const due = await getDueScheduledMessagesForBot();
  for (const row of due) {
    try {
      const channel = await client.channels.fetch(row.chat_channel_id);
      await channel.send(String(row.message_body ?? ""));
      await markScheduledMessageSent({ id: row.id, sentAtUtcIso: new Date().toISOString() });
    } catch (err) {
      console.error(`bot: failed to deliver scheduled message ${row.id}:`, err);
    }
  }
}

/**
 * Start polling for due scheduled messages.
 * @returns {void}
 */
export function startMessageScheduler() {
  if (schedulerHandle) return;
  const tick = async () => {
    if (runInProgress) return;
    runInProgress = true;
    try {
      await processDueScheduledMessages();
    } catch (err) {
      console.error("bot: scheduled-message delivery error:", err);
    } finally {
      runInProgress = false;
    }
  };
  tick();
  schedulerHandle = setInterval(tick, POLL_INTERVAL_MS);
}

/**
 * Stop polling for due scheduled messages.
 * @returns {void}
 */
export function stopMessageScheduler() {
  if (!schedulerHandle) return;
  clearInterval(schedulerHandle);
  schedulerHandle = null;
}
