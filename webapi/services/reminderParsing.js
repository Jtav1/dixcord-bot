/**
 * Client-agnostic parsing of "remind me" style reminder text into a schedule time + body.
 * Callers (the Discord bot, or any future chat client) strip their platform's mention
 * syntax before calling this, and pass the remaining plain text.
 */

import * as chrono from "chrono-node";

const REMIND_ME = "remind me";

/**
 * @typedef {object} ReminderParseResult
 * @property {boolean} ok
 * @property {string} [scheduledAt] - ISO 8601 UTC timestamp.
 * @property {string|null} [messageContent] - Reminder body extracted from text, or null when
 *   `usesReplyContext` is true (caller should build the body itself, e.g. a mention + link to
 *   the message being replied to).
 * @property {boolean} [usesReplyContext]
 * @property {string} [error]
 */

/**
 * Parse "[at/in] <time> remind me <message>" or "remind me [at/in <time>] <message>" (and,
 * for a reply with no explicit time, "remind me <time phrase>" using the reply as the body).
 * @param {{ text: string, isReply?: boolean }} payload - Mention-stripped text and reply context.
 * @returns {ReminderParseResult}
 */
export function parseReminderText(payload) {
  const trimmed = String(payload?.text ?? "").trim();
  const isReply = Boolean(payload?.isReply);

  if (!trimmed) {
    return { ok: false, error: "Reminder text is required" };
  }

  const lower = trimmed.toLowerCase();
  const remindMeIdx = lower.indexOf(REMIND_ME);

  // Format: "[at/in] <time> remind me <message>"
  if (lower.startsWith("at") || lower.startsWith("in")) {
    if (remindMeIdx < 0) {
      return { ok: false, error: "Missing \"remind me\" in reminder text" };
    }

    const scheduledAt = chrono.parseDate(
      trimmed.substring(0, remindMeIdx).trim(),
      Date.now(),
      { forwardDate: true },
    );
    if (!scheduledAt) {
      return { ok: false, error: "Could not parse a time from the reminder text" };
    }

    const messageContent = trimmed
      .substring(remindMeIdx + REMIND_ME.length)
      .trim();
    if (!messageContent) {
      return { ok: false, error: "Missing reminder message" };
    }

    return {
      ok: true,
      scheduledAt: scheduledAt.toISOString(),
      messageContent,
      usesReplyContext: false,
    };
  }

  // Format: "remind me [at/in <time>] <message>"
  if (lower.startsWith(REMIND_ME)) {
    const postRemindMe = trimmed.substring(remindMeIdx + REMIND_ME.length).trim();
    const postLower = postRemindMe.toLowerCase();

    if (postLower.startsWith("at") || postLower.startsWith("in")) {
      const parseResults = chrono.parse(postRemindMe, Date.now(), {
        forwardDate: true,
      });
      if (!parseResults?.length) {
        return { ok: false, error: "Could not parse a time from the reminder text" };
      }

      const first = parseResults[0];
      const scheduledAt = first.start.date();
      let messageContent = postRemindMe
        .substring(first.index + first.text.length)
        .trim();
      if (!messageContent) {
        return { ok: false, error: "Missing reminder message" };
      }
      if (messageContent.toLowerCase().startsWith("to")) {
        messageContent = messageContent.substring(3).trim();
      }

      return {
        ok: true,
        scheduledAt: scheduledAt.toISOString(),
        messageContent,
        usesReplyContext: false,
      };
    }

    if (isReply) {
      const scheduledAt = chrono.parseDate(postRemindMe);
      if (!scheduledAt) {
        return { ok: false, error: "Could not parse a time from the reminder text" };
      }

      return {
        ok: true,
        scheduledAt: scheduledAt.toISOString(),
        messageContent: null,
        usesReplyContext: true,
      };
    }
  }

  return { ok: false, error: "Unrecognized reminder format" };
}
