/**
 * Parse human-readable schedule strings with moment (calendar) and simple
 * relative phrases ("in N minutes/hours/days").
 */

import moment from "moment";

/** @type {string[]} Strict parse order for absolute times (UTC). */
const CALENDAR_FORMATS = [
  moment.ISO_8601,
  "YYYY-MM-DD HH:mm:ss",
  "YYYY-MM-DDTHH:mm:ss",
  "YYYY-MM-DD",
  "MM-DD-YYYYTHH:mm:ss[Z]",
  "MM-DD-YYYYTHH:mm:ss",
  "MM-DD-YYYY HH:mm:ss[Z]",
  "MM-DD-YYYY HH:mm:ss [Z]",
  "MM-DD-YYYY HH:mm:ss",
  "MM-DD-YYYYTHH:mm",
  "MM-DD-YYYY HH:mm[Z]",
  "MM-DD-YYYY HH:mm [Z]",
  "MM-DD-YYYY HH:mm",
  "MM-DD-YYYY",
  "M-D-YYYYTHH:mm:ss[Z]",
  "M-D-YYYYTHH:mm:ss",
  "M-D-YYYY HH:mm:ss[Z]",
  "M-D-YYYY HH:mm:ss [Z]",
  "M-D-YYYY HH:mm:ss",
  "M-D-YYYYTHH:mm",
  "M-D-YYYY HH:mm[Z]",
  "M-D-YYYY HH:mm [Z]",
  "M-D-YYYY HH:mm",
  "M-D-YYYY",
  "MM/DD/YYYY HH:mm",
  "MM/DD/YYYY h:mm a",
  "MM/DD/YYYY",
  "HH:mm",
  "h:mm a",
  "h:mm A",
];

/** Relative "in …" with explicit unit word (whole-string or before reminder text). */
const REL_IN_PREFIX =
  /^in\s+(?:(\d+)|(?:a|an))\s+(minute|minutes|hour|hours|day|days)\b/i;

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeScheduleText(text) {
  return String(text ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

/**
 * Trailing " UTC" / " utc" is a label only; moment strict strings treat it as junk.
 * @param {string} t
 * @returns {string}
 */
function stripTrailingUtcLabel(t) {
  return t.replace(/\s+(?:UTC|utc)\s*$/, "").trim();
}

/**
 * MM-DD-YYYY (or M-D-YYYY) with a clock time, optional Z / UTC, then message — no `|` needed.
 * @param {string} raw
 * @returns {{ timePart: string, messagePart: string } | null}
 */
function trySplitLeadingMdYDateTimeAndMessage(raw) {
  const re =
    /^(\d{1,2}-\d{1,2}-\d{4})[T\s]+(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*(?:UTC|utc)|[Zz])?\s+([\s\S]+)$/i;
  const m = re.exec(raw);
  if (!m) return null;
  const messagePart = String(m[3] ?? "").trim();
  if (!messagePart) return null;
  const timePart = `${m[1]} ${m[2]}`;
  return { timePart, messagePart };
}

/**
 * Parse a standalone "when" string (slash command `when` option).
 * Supports relative `in N minutes|hours|days` (whole string) and strict moment formats.
 * @param {string} text
 * @returns {{ scheduledAt: Date } | { error: string }}
 */
export function parseWhen(text) {
  const t = normalizeScheduleText(text);
  if (!t) {
    return { error: "When is empty." };
  }

  const rel = matchRelativeWhole(t);
  if (rel) {
    return { scheduledAt: rel.toDate() };
  }

  const abs = stripTrailingUtcLabel(t);
  const m = moment.utc(abs, CALENDAR_FORMATS, true);
  if (m.isValid()) {
    return { scheduledAt: m.toDate() };
  }

  const mLocal = moment(abs, CALENDAR_FORMATS, true);
  if (mLocal.isValid()) {
    return { scheduledAt: mLocal.toDate() };
  }

  return {
    error:
      'Could not parse that time. Try ISO date, "in 15 minutes", MM-DD-YYYY with time in UTC, or "MM/DD/YYYY 3:00 PM".',
  };
}

/**
 * Parse combined text after "remind me" — relative "in N unit message" or time-only (invalid if no message).
 * @param {string} text
 * @returns {{ scheduledAt: Date, remainderText: string } | { error: string }}
 */
export function parseRemindBody(text) {
  const raw = normalizeScheduleText(text);
  if (!raw) {
    return {
      error:
        'Add when to be reminded and what to say (e.g. "in 10 minutes take out the trash").',
    };
  }

  const relWithMsg = new RegExp(
    String.raw`${REL_IN_PREFIX.source}\s*[,;:.]?\s+([\s\S]+)$`,
    "i",
  ).exec(raw);
  if (relWithMsg) {
    const n = relWithMsg[1] ? parseInt(relWithMsg[1], 10) : 1;
    const unit = normalizeUnit(relWithMsg[2]);
    const remainderText = String(relWithMsg[3] ?? "").trim();
    if (!remainderText) {
      return { error: "Add the reminder text after the time." };
    }
    const scheduledAt = moment().add(n, unit).toDate();
    return { scheduledAt, remainderText };
  }

  if (new RegExp(String.raw`${REL_IN_PREFIX.source}\s*$`, "i").test(raw)) {
    return {
      error: "Add what to remind you about after the time (e.g. in 5 minutes …).",
    };
  }

  const split = splitTimeAndMessage(raw);
  if (split) {
    const timePart = split.timePart.trim();
    const remainderText = split.messagePart.trim();
    if (!remainderText) {
      return { error: "Add the reminder message after the time." };
    }
    const when = parseWhen(timePart);
    if ("error" in when) {
      return when;
    }
    return { scheduledAt: when.scheduledAt, remainderText };
  }

  const leading = trySplitLeadingMdYDateTimeAndMessage(raw);
  if (leading) {
    const when = parseWhen(leading.timePart);
    if ("error" in when) {
      return when;
    }
    return { scheduledAt: when.scheduledAt, remainderText: leading.messagePart };
  }

  const whenOnly = parseWhen(raw);
  if ("scheduledAt" in whenOnly) {
    return {
      error:
        "Add what to remind you about (time parsed, but no reminder text found).",
    };
  }

  return whenOnly;
}

/**
 * @param {string} t
 * @returns {moment.Moment | null}
 */
function matchRelativeWhole(t) {
  const m = new RegExp(String.raw`${REL_IN_PREFIX.source}\s*$`, "i").exec(t);
  if (!m) return null;
  const n = m[1] ? parseInt(m[1], 10) : 1;
  const unit = normalizeUnit(m[2]);
  return moment().add(n, unit);
}

/**
 * @param {string} u
 * @returns {"minutes"|"hours"|"days"}
 */
function normalizeUnit(u) {
  const s = String(u).toLowerCase();
  if (s.startsWith("minute")) return "minutes";
  if (s.startsWith("hour")) return "hours";
  return "days";
}

/**
 * Split "time | message" or "time / message" or "time — message".
 * @param {string} raw
 * @returns {{ timePart: string, messagePart: string } | null}
 */
function splitTimeAndMessage(raw) {
  const pipe = raw.indexOf(" | ");
  if (pipe !== -1) {
    return {
      timePart: raw.slice(0, pipe),
      messagePart: raw.slice(pipe + 3),
    };
  }
  const slash = raw.indexOf(" / ");
  if (slash !== -1) {
    return {
      timePart: raw.slice(0, slash),
      messagePart: raw.slice(slash + 3),
    };
  }
  const em = raw.indexOf(" — ");
  if (em !== -1) {
    return {
      timePart: raw.slice(0, em),
      messagePart: raw.slice(em + 3),
    };
  }
  return null;
}
