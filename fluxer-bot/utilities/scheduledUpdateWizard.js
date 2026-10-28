import {
  parseTimeExpression,
  updateScheduledMessageForUser,
} from "../api/scheduledMessages.js";
import { isExitCommand } from "./commandHelpers.js";

/**
 * Multi-turn DM wizard for !scheduled-update (fluxer.js has no named slash-command options, so
 * id/time/message are collected one at a time over DM instead of parsed from one message).
 */

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

/** @type {Map<string, { step: "id"|"time"|"message", id?: number, scheduledAt?: string, messageContent?: string, timeout: NodeJS.Timeout }>} */
const sessions = new Map();

function clearSession(userId) {
  const session = sessions.get(userId);
  if (session) clearTimeout(session.timeout);
  sessions.delete(userId);
}

function armTimeout(userId, user) {
  const session = sessions.get(userId);
  if (!session) return;
  clearTimeout(session.timeout);
  session.timeout = setTimeout(() => {
    sessions.delete(userId);
    user
      .send("Scheduled-update timed out; run `!scheduled-update` again.")
      .catch(() => null);
  }, SESSION_TIMEOUT_MS);
}

/**
 * @param {string} userId
 * @returns {boolean}
 */
export function hasActiveSession(userId) {
  return sessions.has(userId);
}

/**
 * Begin (or restart) the wizard for this user.
 * @param {import('@fluxerjs/core').User} user
 */
export async function startScheduledUpdateWizard(user) {
  clearSession(user.id);
  sessions.set(user.id, { step: "id", timeout: null });
  armTimeout(user.id, user);
  await user
    .send(
      "Reply with the **id** of the reminder to update (from `!scheduled-list`), or `exit`.",
    )
    .catch(() => null);
}

/**
 * Advance one DM reply through the wizard. No-op if the author has no active session.
 * @param {import('@fluxerjs/core').Message} message
 */
export async function handleWizardReply(message) {
  const userId = message.author.id;
  const session = sessions.get(userId);
  if (!session) return;

  const user = message.author;
  const text = String(message.content ?? "").trim();

  if (isExitCommand(text) || /^cancel$/i.test(text)) {
    clearSession(userId);
    await user.send("Cancelled.").catch(() => null);
    return;
  }

  if (session.step === "id") {
    if (!/^\d+$/.test(text)) {
      await user
        .send(
          "That doesn't look like a valid id. Reply with the **id** of the reminder to update (from `!scheduled-list`), or `exit`.",
        )
        .catch(() => null);
      return;
    }
    session.id = Number(text);
    session.step = "time";
    armTimeout(userId, user);
    await user
      .send(
        "Reply with a new **time** (e.g. `at 5pm`, `in 2 hours`), or `skip` to leave it unchanged.",
      )
      .catch(() => null);
    return;
  }

  if (session.step === "time") {
    if (!/^skip$/i.test(text)) {
      const parsedTime = await parseTimeExpression(text);
      if (!parsedTime.ok) {
        await user
          .send(
            `Could not understand that time: ${parsedTime.error}\nReply with a new **time** (e.g. \`at 5pm\`, \`in 2 hours\`), or \`skip\`.`,
          )
          .catch(() => null);
        return;
      }
      session.scheduledAt = parsedTime.scheduledAt;
    }
    session.step = "message";
    armTimeout(userId, user);
    await user
      .send("Reply with a new **message**, or `skip` to leave it unchanged.")
      .catch(() => null);
    return;
  }

  // session.step === "message" — last step
  if (!/^skip$/i.test(text)) {
    session.messageContent = text;
  }
  clearSession(userId);

  if (!session.scheduledAt && !session.messageContent) {
    await user
      .send(
        "You skipped both — nothing to update. Run `!scheduled-update` again if you want to change something.",
      )
      .catch(() => null);
    return;
  }

  try {
    const updated = await updateScheduledMessageForUser({
      id: session.id,
      requesterUserId: userId,
      messageContent: session.messageContent,
      scheduledAt: session.scheduledAt,
    });
    if (!updated) {
      await user
        .send(
          "Could not update that reminder. It may not exist, may already be sent, or may not belong to you.",
        )
        .catch(() => null);
      return;
    }
    await user
      .send(
        `Updated scheduled reminder #${updated.id}. New UTC time: ${updated.scheduled_at}`,
      )
      .catch(() => null);
  } catch (err) {
    console.log("bot: scheduled-update wizard failed:", err);
    await user.send("Failed to update scheduled reminder.").catch(() => null);
  }
}
