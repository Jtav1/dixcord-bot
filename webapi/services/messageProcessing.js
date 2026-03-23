/**
 * Message processing / logging: emoji counting and plus/minus in messages.
 * Uses configured DB (mysql or sqlite). Compatible with dixcord-bot tables.
 */

import db from "../config/db.js";

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
 * @private
 */
async function upsertUserEmoji(userId, emojiId) {
  if (!userId || !emojiId) return;

  const [rows] = await db.query(
    "SELECT frequency FROM user_emoji_tracking WHERE userid = ? AND emoid = ?",
    [userId, emojiId],
  );

  if (rows && rows.length > 0) {
    await db.query(
      "UPDATE user_emoji_tracking SET frequency = frequency + 1 WHERE userid = ? AND emoid = ?",
      [userId, emojiId],
    );
  } else {
    await db.query(
      "INSERT INTO user_emoji_tracking (userid, emoid, frequency) VALUES (?, ?, 1)",
      [userId, emojiId],
    );
  }
}

/**
 * Record emoji usage from a message. Optionally records a +/- vote when replying with one plus/minus emoji.
 * @param {object} payload - { authorId, emojis: Array<{ name, id? }>, isReply?, repliedUserId? }
 * @returns {Promise<{ ok: boolean, applied?: string }>}
 */
export async function countEmoji(payload) {
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
    (e) => e.id && String(e.id) === plusEmojiId,
  ).length;
  const minusCount = emojis.filter(
    (e) => e.id && String(e.id) === minusEmojiId,
  ).length;

  const doPlusMinus =
    isReply &&
    repliedUserId &&
    plusCount + minusCount === 1 &&
    emojis.length === 1;

  if (doPlusMinus && plusCount === 1) {
    await recordPlusPlus(repliedUserId, "user", authorId, 1);
    return { ok: true, applied: "plus" };
  }
  if (doPlusMinus && minusCount === 1) {
    await recordPlusPlus(repliedUserId, "user", authorId, -1);
    return { ok: true, applied: "minus" };
  }

  for (const em of emojis) {
    const name = String(em.name ?? "?");
    const id = em.id != null ? String(em.id) : name;
    await ensureAndIncrementEmoji(id, name, em.animated, em.type);
    if (id && authorId) {
      await upsertUserEmoji(authorId, id);
    }
  }
  return { ok: true };
}

// --- Plus/minus in messages ---

async function recordPlusPlus(string, typestr, voterid, value) {
  if (!typestr || !string || !voterid) return;
  if (typestr === "user" && string === voterid) return;
  await db.query(
    "INSERT INTO plusplus_tracking (type, string, voter, value) VALUES (?, ?, ?, ?)",
    [typestr, string, voterid, value],
  );
}

/**
 * Parse message for word++ / user++ / -- and record votes.
 * @param {object} payload - { message: { content, author: { id } }, voterId }
 * @returns {Promise<{ ok: boolean, recorded?: number }>}
 */
export async function recordPlusMinusMessage(payload) {
  const { message, voterId } = payload;
  const content = message?.content ?? "";
  if (!voterId) return { ok: false, error: "voterId is required" };

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
      await recordPlusPlus(target, matchtype, voterId, 1);
      recorded++;
    } else if (m.type === "--" && matchtype) {
      await recordPlusPlus(target, matchtype, voterId, -1);
      recorded++;
    }
  }
  return { ok: true, recorded };
}

/**
 * Record a single plus or minus from a reaction. Writes to plusplus_tracking (type='user'). Self-votes are rejected.
 * @param {object} payload - { targetUserId, reactorId, value: 1 | -1 }
 * @returns {Promise<{ ok: boolean, recorded?: number, value?: number }>}
 */
export async function recordPlusMinusReaction(payload) {
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
  await recordPlusPlus(String(targetUserId), "user", String(reactorId), value);
  return { ok: true, recorded: 1, value };
}

// --- Repost tracking ---

/**
 * Record or withdraw a repost accusation.
 * @param {object} payload - { userid, msgid, accuser, msgcontents?, repost: 1 | -1 }
 * @returns {Promise<{ ok: boolean, action?: string, deleted?: number }>}
 */
export async function countRepost(payload) {
  const { userid, msgid, accuser, msgcontents = "", repost } = payload;
  if (!userid || !msgid || !accuser)
    return { ok: false, error: "userid, msgid, and accuser are required" };
  if (repost !== 1 && repost !== -1)
    return { ok: false, error: "repost must be 1 or -1" };

  if (repost === 1) {
    const [existing] = await db.query(
      "SELECT 1 FROM user_repost_tracking WHERE userid = ? AND msgid = ? AND accuser = ?",
      [userid, msgid, accuser],
    );
    if (existing && existing.length > 0) {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await db.query(
        "UPDATE user_repost_tracking SET msgcontents = ?, timestamp = ? WHERE userid = ? AND msgid = ? AND accuser = ?",
        [msgcontents || null, now, userid, msgid, accuser],
      );
    } else {
      await db.query(
        "INSERT INTO user_repost_tracking (userid, msgid, accuser, msgcontents) VALUES (?, ?, ?, ?)",
        [userid, msgid, accuser, msgcontents || null],
      );
    }
    return { ok: true, action: "created" };
  }

  if (repost === -1) {
    const [result] = await db.query(
      "DELETE FROM user_repost_tracking WHERE msgid = ? AND accuser = ?",
      [msgid, accuser],
    );
    const deleted = result?.affectedRows ?? result?.changes ?? 0;
    return { ok: true, action: "withdrawn", deleted };
  }

  return { ok: false };
}

// --- Emoji import (sync server emoji list; mirrors bot database/emojis.js importEmojiList) ---

/**
 * Import server emoji list: delete unused type='emoji' rows (frequency = 0), then upsert each emoji.
 * Preserves frequency for existing emojis; adds new ones with frequency 0.
 * @param {Array<{ id: string, name: string, animated?: boolean }>} emojis - From guild.emojis.cache or similar
 * @returns {Promise<{ ok: boolean, imported?: number }>}
 */
export async function importEmojiList(emojis) {
  if (!Array.isArray(emojis)) return { ok: false };
  const list = emojis.filter(
    (e) => e != null && (e.id != null || e.name != null),
  );
  // 1. Cleanup: remove server emojis that were never used (same as bot importEmojiList)
  await db.query(
    "DELETE FROM emoji_frequency WHERE frequency = 0 AND (type = 'emoji' OR type IS NULL)",
  );
  let imported = 0;
  for (const e of list) {
    const id = String(e.id ?? "").trim();
    const name = String((e.name ?? id) || "?").trim();
    const animated = e.animated ? 1 : 0;
    const type =
      e.type != null && String(e.type).trim() !== ""
        ? String(e.type).trim()
        : null;
    if (id.length === 0 && name === "?") continue;
    const [existing] = await db.query(
      "SELECT 1 FROM emoji_frequency WHERE emoid = ?",
      [id || name],
    );
    if (existing && existing.length > 0) continue; // preserve frequency
    await db.query(
      "INSERT INTO emoji_frequency (emoid, emoji, frequency, animated, type) VALUES (?, ?, 0, ?, ?)",
      [id || name, name, animated, type],
    );
    imported++;
  }
  return { ok: true, imported };
}

// --- Sticker import (sync server sticker list; like emoji import, no animated) ---

/**
 * Import server sticker list: delete unused rows (frequency = 0), then upsert each sticker.
 * Preserves frequency for existing stickers; adds new ones with frequency 0.
 * @param {Array<{ id: string, name: string }>} stickers - From guild.stickers.cache or similar
 * @returns {Promise<{ ok: boolean, imported?: number }>}
 */
export async function importStickerList(stickers) {
  if (!Array.isArray(stickers)) return { ok: false };
  const list = stickers.filter(
    (s) => s != null && (s.id != null || s.name != null),
  );
  await db.query("DELETE FROM sticker_frequency WHERE frequency = 0");
  let imported = 0;
  for (const s of list) {
    const id = String(s.id ?? "").trim();
    const name = String((s.name ?? id) || "?").trim();
    if (id.length === 0 && name === "?") continue;
    const [existing] = await db.query(
      "SELECT 1 FROM sticker_frequency WHERE stickerid = ?",
      [id || name],
    );
    if (existing && existing.length > 0) continue;
    await db.query(
      "INSERT INTO sticker_frequency (stickerid, name, frequency) VALUES (?, ?, 0)",
      [id || name, name],
    );
    imported++;
  }
  return { ok: true, imported };
}

// --- User mapping import (Discord snowflake directory) ---

/**
 * Bulk upsert rows into chat_member_mapping, keyed by discord_id.
 * @param {Array<{ name: string, discord_handle: string, discord_id: string }>} users
 * @returns {Promise<{ ok: boolean, imported?: number }>} imported = rows processed (insert or update); skips invalid rows.
 */
export async function importUserMappingList(users) {
  if (!Array.isArray(users)) return { ok: false };
  const isSqlite = (process.env.DB_TYPE || "mysql").toLowerCase() === "sqlite";
  let imported = 0;
  for (const u of users) {
    if (u == null) continue;
    const discord_id = String(u.discord_id ?? "").trim();
    const name = String(u.name ?? "").trim();
    const discord_handle = String(u.discord_handle ?? "").trim();
    if (!discord_id || !name || !discord_handle) continue;
    if (isSqlite) {
      await db.query(
        `INSERT INTO chat_member_mapping (name, discord_handle, discord_id) VALUES (?, ?, ?)
         ON CONFLICT(discord_id) DO UPDATE SET
           name = excluded.name,
           discord_handle = excluded.discord_handle`,
        [name, discord_handle, discord_id],
      );
    } else {
      await db.query(
        `INSERT INTO chat_member_mapping (name, discord_handle, discord_id) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           discord_handle = VALUES(discord_handle)`,
        [name, discord_handle, discord_id],
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
