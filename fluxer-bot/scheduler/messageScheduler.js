/**
 * Delivers due scheduled reminders (created via @bot remind me ...) to their channel.
 * Due-time comparison happens server-side; this just sends whatever webapi reports as due.
 */

import { client } from "../fluxerClient.js";
import {
  getDueScheduledMessagesForBot,
  markScheduledMessageDelivered,
  markScheduledMessageSent,
} from "../api/scheduledMessages.js";

const POLL_INTERVAL_MS = 15_000;

let runInProgress = false;
let schedulerHandle = null;

/**
 * Send every currently-due scheduled message and mark it. Best-effort per row. Each due row is
 * one of two kinds (see getDueScheduledMessagesForBot): `"home"` rows this app owns are posted
 * in their own channel and marked sent; `"foreign"` rows another app owns are delivered as a DM
 * to the requester's linked Fluxer account (no equivalent channel exists cross-platform) and
 * recorded via the separate /delivered endpoint, which never touches the row's own status.
 * @returns {Promise<void>}
 */
export async function processDueScheduledMessages() {
  const due = await getDueScheduledMessagesForBot();
  for (const row of due) {
    try {
      if (row.deliveryKind === "foreign") {
        const user = await client.users.fetch(row.targetPlatformUserId);
        await user.send(String(row.message_body ?? ""));
        await markScheduledMessageDelivered({ id: row.id });
        continue;
      }

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
