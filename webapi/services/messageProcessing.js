/**
 * Message processing / logging: emoji counting and plus/minus in messages.
 * Uses configured DB (mysql or sqlite). Compatible with dixcord-bot tables.
 */

import db from "../config/db.js";

// --- Config and filter keywords ---

export async function getFilterKeywords() {
  const [rows] = await db.query("SELECT keyword FROM log_filter_keywords");
  return (rows || []).map((r) => (r.keyword || "").toLowerCase());
}

// --- Emoji detector (count emoji usage) ---

/**
 * Ensure emoji_frequency has a row for this emoji; increment frequency.
 * If no row exists, insert one with frequency 1.
 */
async function ensureAndIncrementEmoji(emojiId, emojiName, emojiAnimated) {
  const id = String(emojiId ?? "");
  const name = String((emojiName ?? id) || "?");
  const animated = emojiAnimated ? 1 : 0;
  const [existing] = await db.query("SELECT 1 FROM emoji_frequency WHERE emoid = ?", [id]);
  if (existing && existing.length > 0) {
    if(emojiId.length > 0 && emojiName.length > 0) {
      await db.query(
        "UPDATE emoji_frequency SET frequency = frequency + 1 WHERE emoid = ?",
        [id]
      );
    }
  } else {
    if(emojiId.length > 0 && emojiName.length > 0) {
      await db.query(
        "INSERT INTO emoji_frequency (emoid, emoji, frequency, animated, type) VALUES (?, ?, 1, ?, ?)",
        [id, name, animated, "emoji"]
      );
    }
  }
}

/**
 * Upsert user_emoji_tracking. DB-agnostic: SELECT then INSERT or UPDATE.
 */
async function upsertUserEmoji(userId, emojiId) {
  if (!userId || !emojiId) return;
  const [rows] = await db.query(
    "SELECT frequency FROM user_emoji_tracking WHERE userid = ? AND emoid = ?",
    [userId, emojiId]
  );
  if (rows && rows.length > 0) {
    await db.query(
      "UPDATE user_emoji_tracking SET frequency = frequency + 1 WHERE userid = ? AND emoid = ?",
      [userId, emojiId]
    );
  } else {
    await db.query(
      "INSERT INTO user_emoji_tracking (userid, emoid, frequency) VALUES (?, ?, 1)",
      [userId, emojiId]
    );
  }
}

/**
 * Record emoji usage from a message.
 * Body shape: { authorId: string, emojis: Array<{ name: string, id?: string }> }
 * Optional: isReply, repliedUserId, plusEmojiId, minusEmojiId — if exactly one plus or minus emoji in a reply, record a +/- vote for repliedUserId instead of counting.
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
    "SELECT value FROM configurations WHERE config = 'plusplus_emoji'"
  );
  const [minusRows] = await db.query(
    "SELECT value FROM configurations WHERE config = 'minusminus_emoji'"
  );
  const plusEmojiId = plusRows && plusRows.length > 0 ? String(plusRows[0].value) : null;
  const minusEmojiId = minusRows && minusRows.length > 0 ? String(minusRows[0].value) : null;


  if (!authorId || !Array.isArray(emojis) || emojis.length === 0) {
    return { ok: true };
  }

  const plusCount = emojis.filter((e) => e.id && String(e.id) === plusEmojiId).length;
  const minusCount = emojis.filter((e) => e.id && String(e.id) === minusEmojiId).length;

  const doPlusMinus =
    isReply &&
    repliedUserId &&
    (plusCount + minusCount === 1) &&
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
    await ensureAndIncrementEmoji(id, name, em.animated);
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
  const val = value === -1 ? -1 : 1;
  await db.query(
    "INSERT INTO plusplus_tracking (type, string, voter, value) VALUES (?, ?, ?, ?)",
    [typestr, string, voterid, val]
  );
}

/**
 * Parse message for word++ / user++ / -- and record votes (respecting filter list).
 * Body shape: { message: string, voterId: string }
 */
export async function recordPlusMinusMessage(payload) {
  const { message = "", voterId } = payload;
  if (!voterId) return { ok: true, recorded: 0 };

  const filterWords = await getFilterKeywords();
  const regex = /(\S+)\s*(\+\+|\-\-)/g;
  let match;
  const matches = [];
  while ((match = regex.exec(message)) !== null) {
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
    if (filterWords.includes(target.toLowerCase())) matchtype = null;
    if (target.length < 1) matchtype = null;

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
