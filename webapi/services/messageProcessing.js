/**
 * Message processing / logging: emoji counting and plus/minus in messages.
 * Uses configured DB (mysql or sqlite). Compatible with dixcord-bot tables.
 * Payload user ids are Discord snowflakes (strings); storage uses chat_member_mapping FK ints.
 */

import db from "../config/db.js";
import {
  CHAT_MEMBER_APP_CONFIG,
  isChatMemberAppSupported,
  requireChatMemberMappingId,
  UNKNOWN_CHAT_MEMBER_ERROR,
} from "./chatMemberMapping.js";

/**
 * @param {Record<string, unknown> | null | undefined} payload
 * @returns {{ ok: true, app: string } | { ok: false, error: string }}
 */
function requireChatAppFromPayload(payload) {
  const app = payload?.app;
  if (!isChatMemberAppSupported(app)) {
    return {
      ok: false,
      error: 'Parameter "app" is required and must be "discord".',
    };
  }
  return { ok: true, app };
}

// --- Emoji detector (count emoji usage) ---

/**
 * Ensure emoji_frequency has a row for this emoji; increment frequency.
 * If no row exists, insert one with frequency 1.
 * @param {string} [emojiType] - Type from request (e.g. 'emoji'); if missing, type is stored as null.
 * @private
 */
async function ensureAndIncrementEmoji(
  emojiId,
  emojiName,
  emojiAnimated,
  emojiType,
) {
  const id = String(emojiId ?? "");
  const name = String((emojiName ?? id) || "?");
  const animated = emojiAnimated ? 1 : 0;
  const type =
    emojiType != null && String(emojiType).trim() !== ""
      ? String(emojiType).trim()
      : null;

  const [existing] = await db.query(
    "SELECT 1 FROM emoji_frequency WHERE emoid = ?",
    [id],
  );

  if (existing && existing.length > 0) {
    if (emojiId.length > 0 && emojiName.length > 0) {
      await db.query(
        "UPDATE emoji_frequency SET frequency = frequency + 1 WHERE emoid = ?",
        [id],
      );
    }
  } else {
    if (emojiId.length > 0 && emojiName.length > 0) {
      await db.query(
        "INSERT INTO emoji_frequency (emoid, emoji, frequency, animated, type) VALUES (?, ?, 1, ?, ?)",
        [id, name, animated, type],
      );
    }
  }
}

/**
 * Upsert user_emoji_tracking. DB-agnostic: SELECT then INSERT or UPDATE.
 * @param {number} chatMemberMappingId - chat_member_mapping.id
 * @private
 */
async function upsertUserEmoji(chatMemberMappingId, emojiId) {
  if (chatMemberMappingId == null || !emojiId) return;

  const [rows] = await db.query(
    "SELECT frequency FROM user_emoji_tracking WHERE userid = ? AND emoid = ?",
    [chatMemberMappingId, emojiId],
  );

  if (rows && rows.length > 0) {
    await db.query(
      "UPDATE user_emoji_tracking SET frequency = frequency + 1 WHERE userid = ? AND emoid = ?",
      [chatMemberMappingId, emojiId],
    );
  } else {
    await db.query(
      "INSERT INTO user_emoji_tracking (userid, emoid, frequency) VALUES (?, ?, 1)",
      [chatMemberMappingId, emojiId],
    );
  }
}

/**
 * Record emoji usage from a message. Optionally records a +/- vote when replying with one plus/minus emoji.
 * @param {object} payload - { app: string, authorId: string (snowflake), emojis: Array<{ name, id? }>, isReply?, repliedUserId? }
 * @returns {Promise<{ ok: boolean, applied?: string, error?: string }>}
 */
export async function countEmoji(payload) {
  const appCheck = requireChatAppFromPayload(payload);
  if (!appCheck.ok) return appCheck;
  const chatApp = appCheck.app;

  const {
    authorId,
    emojis = [],
    isReply = false,
    repliedUserId = null,
  } = payload;

  // Fetch plusplus_emoji and minusminus_emoji config values from the database
  // Assume db.query returns [rows] as in previous functions
  const [plusRows] = await db.query(
    "SELECT value FROM configurations WHERE config = 'plusplus_emoji'",
  );

  const [minusRows] = await db.query(
    "SELECT value FROM configurations WHERE config = 'minusminus_emoji'",
  );

  const plusEmojiId =
    plusRows && plusRows.length > 0 ? String(plusRows[0].value) : null;
  const minusEmojiId =
    minusRows && minusRows.length > 0 ? String(minusRows[0].value) : null;

  if (!authorId || !Array.isArray(emojis) || emojis.length === 0) {
    return { ok: false };
  }

  const plusCount = emojis.filter(
    (e) =>
      (e.id && String(e.id) === plusEmojiId) ||
      (e.name && e.name === plusEmojiId),
  ).length;
  const minusCount = emojis.filter(
    (e) =>
      (e.id && String(e.id) === minusEmojiId) ||
      (e.name && e.name === minusEmojiId),
  ).length;

  const doPlusMinus = isReply && repliedUserId && plusCount + minusCount === 1;

  if (doPlusMinus && plusCount === 1) {
    const ok = await recordPlusPlus(
      repliedUserId,
      "user",
      authorId,
      1,
      chatApp,
    );
    if (!ok) return { ok: false, error: UNKNOWN_CHAT_MEMBER_ERROR };
    return { ok: true, applied: "plus" };
  }
  if (doPlusMinus && minusCount === 1) {
    const ok = await recordPlusPlus(
      repliedUserId,
      "user",
      authorId,
      -1,
      chatApp,
    );
    if (!ok) return { ok: false, error: UNKNOWN_CHAT_MEMBER_ERROR };
    return { ok: true, applied: "minus" };
  }

  const authorMap = await requireChatMemberMappingId(authorId, chatApp);
  if (!authorMap.ok) return { ok: false, error: authorMap.error };

  for (const em of emojis) {
    const name = String(em.name ?? "?");
    const id = em.id != null ? String(em.id) : name;
    await ensureAndIncrementEmoji(id, name, em.animated, em.type);
    if (id && authorId) {
      await upsertUserEmoji(authorMap.id, id);
    }
  }
  return { ok: true };
}

// --- Plus/minus in messages ---

/**
 * @param {string} target - word text, or target user snowflake when typestr is 'user'
 * @param {'word'|'user'} typestr
 * @param {string} voterDiscordId - voter snowflake
 * @param {number} value - 1 or -1
 * @param {string} chatApp - e.g. "discord"
 * @returns {Promise<boolean>} false if mapping missing or invalid
 */
async function recordPlusPlus(target, typestr, voterDiscordId, value, chatApp) {
  if (!typestr || !voterDiscordId) return false;
  if (typestr === "user" && String(target) === String(voterDiscordId))
    return false;

  const voterRes = await requireChatMemberMappingId(voterDiscordId, chatApp);
  if (!voterRes.ok) return false;

  if (typestr === "word") {
    if (!target || String(target).trim() === "") return false;
    await db.query(
      "INSERT INTO plusplus_tracking (type, string, voter, value) VALUES (?, ?, ?, ?)",
      ["word", String(target), voterRes.id, value],
    );
    return true;
  }

  const targetRes = await requireChatMemberMappingId(target, chatApp);
  if (!targetRes.ok) return false;

  await db.query(
    "INSERT INTO plusplus_tracking (type, string, voter, value) VALUES (?, ?, ?, ?)",
    ["user", targetRes.id, voterRes.id, value],
  );
  return true;
}

/**
 * Parse message for word++ / user++ / -- and record votes.
 * @param {object} payload - { app: string, message: { content, author: { id } }, voterId: string (snowflake) }
 * @returns {Promise<{ ok: boolean, recorded?: number, error?: string }>}
 */
export async function recordPlusMinusMessage(payload) {
  const appCheck = requireChatAppFromPayload(payload);
  if (!appCheck.ok) return appCheck;
  const chatApp = appCheck.app;

  const { message, voterId } = payload;
  const content = message?.content ?? "";
  if (!voterId) return { ok: false, error: "voterId is required" };

  const voterOk = await requireChatMemberMappingId(voterId, chatApp);
  if (!voterOk.ok) return { ok: false, error: voterOk.error };

  const regex = /(\S+)\s*(\+\+|\-\-)/g;

  let match;
  const matches = [];
  while ((match = regex.exec(content)) !== null) {
    matches.push({ target: match[1], type: match[2] });
  }

  const mentionRegex = /^<@!?(\d+)>$/;
  let recorded = 0;

  for (const m of matches) {
    let target = m.target;
    let matchtype = "word";

    if (mentionRegex.test(target)) {
      target = target.replace(/<@!?/, "").replace(/>/, "").trim();
      if (target === voterId) matchtype = null;
      else matchtype = "user";
    }

    target = target.replace(/[-+\s]/g, "");

    if (target.length < 1) matchtype = null;
    if (!matchtype) continue;

    if (m.type === "++" && matchtype) {
      const ok = await recordPlusPlus(target, matchtype, voterId, 1, chatApp);
      if (ok) recorded++;
    } else if (m.type === "--" && matchtype) {
      const ok = await recordPlusPlus(target, matchtype, voterId, -1, chatApp);
      if (ok) recorded++;
    }
  }
  return { ok: true, recorded };
}

/**
 * Record a single plus or minus from a reaction. Writes to plusplus_tracking (type='user'). Self-votes are rejected.
 * @param {object} payload - { app: string, targetUserId: string, reactorId: string, value: 1 | -1 } (snowflakes)
 * @returns {Promise<{ ok: boolean, recorded?: number, value?: number, error?: string }>}
 */
export async function recordPlusMinusReaction(payload) {
  const appCheck = requireChatAppFromPayload(payload);
  if (!appCheck.ok) return appCheck;
  const chatApp = appCheck.app;

  const { targetUserId, reactorId, value } = payload;
  if (!targetUserId || !reactorId) {
    return { ok: false, error: "targetUserId and reactorId are required" };
  }
  if (value !== 1 && value !== -1) {
    return { ok: false, error: "value must be 1 (plus) or -1 (minus)" };
  }
  if (String(targetUserId) === String(reactorId)) {
    return { ok: false, error: "Cannot vote for yourself" };
  }
  const ok = await recordPlusPlus(
    String(targetUserId),
    "user",
    String(reactorId),
    value,
    chatApp,
  );
  if (!ok) return { ok: false, error: UNKNOWN_CHAT_MEMBER_ERROR };
  return { ok: true, recorded: 1, value };
}

// --- Repost tracking ---

/**
 * Record or withdraw a repost accusation.
 * @param {object} payload - { app: string, userid, msgid, accuser (snowflakes), msgcontents?, repost: 1 | -1 }
 * @returns {Promise<{ ok: boolean, action?: string, deleted?: number, error?: string }>}
 */
export async function countRepost(payload) {
  const appCheck = requireChatAppFromPayload(payload);
  if (!appCheck.ok) return appCheck;
  const chatApp = appCheck.app;

  const { userid, msgid, accuser, msgcontents = "", repost } = payload;
  if (!userid || !msgid || !accuser)
    return { ok: false, error: "userid, msgid, and accuser are required" };
  if (repost !== 1 && repost !== -1)
    return { ok: false, error: "repost must be 1 or -1" };

  const authorRes = await requireChatMemberMappingId(userid, chatApp);
  if (!authorRes.ok) return { ok: false, error: authorRes.error };
  const accRes = await requireChatMemberMappingId(accuser, chatApp);
  if (!accRes.ok) return { ok: false, error: accRes.error };

  const authorId = authorRes.id;
  const accuserId = accRes.id;

  if (repost === 1) {
    const [existing] = await db.query(
      "SELECT 1 FROM user_repost_tracking WHERE userid = ? AND msgid = ? AND accuser = ?",
      [authorId, msgid, accuserId],
    );
    if (existing && existing.length > 0) {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await db.query(
        "UPDATE user_repost_tracking SET msgcontents = ?, timestamp = ? WHERE userid = ? AND msgid = ? AND accuser = ?",
        [msgcontents || null, now, authorId, msgid, accuserId],
      );
    } else {
      await db.query(
        "INSERT INTO user_repost_tracking (userid, msgid, accuser, msgcontents) VALUES (?, ?, ?, ?)",
        [authorId, msgid, accuserId, msgcontents || null],
      );
    }
    return { ok: true, action: "created" };
  }

  if (repost === -1) {
    const [result] = await db.query(
      "DELETE FROM user_repost_tracking WHERE msgid = ? AND accuser = ?",
      [msgid, accuserId],
    );
    const deleted = result?.affectedRows ?? result?.changes ?? 0;
    return { ok: true, action: "withdrawn", deleted };
  }

  return { ok: false };
}

// --- Guild emoji / sticker catalog (emoji_frequency; type = 'emoji' | 'sticker') ---

/**
 * Sync guild custom emojis or stickers into `emoji_frequency`.
 * Rows are distinguished by `emoji_frequency.type`: `"emoji"` or `"sticker"` (not Discord API subtype).
 * Deletes only zero-frequency rows of the same asset kind, then inserts missing ids with frequency 0.
 * @param {Array<{ id: string, name: string, animated?: boolean }>} items - From guild.emojis / guild.stickers
 * @param {"emoji"|"sticker"} assetKind
 * @returns {Promise<{ ok: boolean, imported?: number }>} imported = new rows added (existing emoids skipped)
 */
export async function importGuildAssetFrequencyList(items, assetKind) {
  if (!Array.isArray(items)) return { ok: false };
  if (assetKind !== "emoji" && assetKind !== "sticker") return { ok: false };

  const list = items.filter(
    (e) => e != null && (e.id != null || e.name != null),
  );

  if (assetKind === "emoji") {
    await db.query(
      "DELETE FROM emoji_frequency WHERE frequency = 0 AND (type = 'emoji' OR type IS NULL)",
    );
  } else {
    await db.query(
      "DELETE FROM emoji_frequency WHERE frequency = 0 AND type = 'sticker'",
    );
  }

  let imported = 0;
  for (const e of list) {
    const id = String(e.id ?? "").trim();
    const name = String((e.name ?? id) || "?").trim();
    if (id.length === 0 && name === "?") continue;
    const emoid = id || name;

    const [existing] = await db.query(
      "SELECT 1 FROM emoji_frequency WHERE emoid = ?",
      [emoid],
    );
    if (existing && existing.length > 0) continue;

    if (assetKind === "emoji") {
      const animated = e.animated ? 1 : 0;
      await db.query(
        "INSERT INTO emoji_frequency (emoid, emoji, frequency, animated, type) VALUES (?, ?, 0, ?, ?)",
        [emoid, name, animated, "emoji"],
      );
    } else {
      await db.query(
        "INSERT INTO emoji_frequency (emoid, emoji, frequency, animated, type) VALUES (?, ?, 0, 0, ?)",
        [emoid, name, "sticker"],
      );
    }
    imported++;
  }
  return { ok: true, imported };
}

// --- User mapping import (per-app handle/id columns on chat_member_mapping) ---

/** @deprecated Use isChatMemberAppSupported from ./chatMemberMapping.js */
export const isChatMemberImportAppSupported = isChatMemberAppSupported;

/**
 * Bulk upsert rows into chat_member_mapping. Conflict target is the app’s id column (unique).
 * @param {Array<Record<string, unknown>>} users
 * @param {string} app - e.g. `"discord"` (only supported value today)
 * @returns {Promise<{ ok: boolean, imported?: number, error?: string }>}
 */
export async function importUserMappingList(users, app) {
  if (!Array.isArray(users))
    return { ok: false, error: "users must be an array" };
  if (!isChatMemberAppSupported(app)) {
    return {
      ok: false,
      error: 'Unsupported app; currently only "discord" is accepted.',
    };
  }

  const cfg = CHAT_MEMBER_APP_CONFIG[app];
  const hc = cfg.handleColumn;
  const ic = cfg.idColumn;
  const isSqlite = (process.env.DB_TYPE || "mysql").toLowerCase() === "sqlite";
  let imported = 0;

  for (const u of users) {
    if (u == null) continue;
    const platformId = String(cfg.pickId(u) ?? "").trim();
    const name = String(u.name ?? "").trim();
    const handle = String(cfg.pickHandle(u) ?? "").trim();
    if (!platformId || !name || !handle) continue;

    if (isSqlite) {
      await db.query(
        `INSERT INTO chat_member_mapping (name, \`${hc}\`, \`${ic}\`) VALUES (?, ?, ?)
         ON CONFLICT(\`${ic}\`) DO UPDATE SET
           name = excluded.name,
           \`${hc}\` = excluded.${hc}`,
        [name, handle, platformId],
      );
    } else {
      await db.query(
        `INSERT INTO chat_member_mapping (name, \`${hc}\`, \`${ic}\`) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           \`${hc}\` = VALUES(${hc})`,
        [name, handle, platformId],
      );
    }
    imported++;
  }
  return { ok: true, imported };
}

// --- Pin history (for pin decision + log) ---

/**
 * Check if a message was already logged as pinned.
 * @param {string} messageId - Discord message ID (snowflake)
 * @returns {Promise<boolean>}
 */
export async function isMessageAlreadyPinned(messageId) {
  if (!messageId || String(messageId).trim() === "") return false;
  const id = String(messageId).trim();
  const [rows] = await db.query("SELECT 1 FROM pin_history WHERE msgid = ?", [
    id,
  ]);
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Log a message as pinned (idempotent: no-op if already logged).
 * @param {string} messageId - Discord message ID (snowflake)
 * @returns {Promise<{ ok: boolean }>}
 */
export async function logPinnedMessage(messageId) {
  if (!messageId || String(messageId).trim() === "") {
    return { ok: false };
  }
  const id = String(messageId).trim();
  const already = await isMessageAlreadyPinned(id);
  if (already) return { ok: true };
  await db.query("INSERT INTO pin_history (msgid) VALUES (?)", [id]);
  return { ok: true };
}
