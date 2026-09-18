/**
 * Message processing / logging: emoji counting and plus/minus in messages.
 * Uses configured DB (mysql or sqlite). Compatible with dixcord-bot tables.
 * Payload user ids are Discord snowflakes (strings); storage uses chat_member_mapping FK ints.
 */

import db from "../config/db.js";
import {
  isChatMemberAppSupported,
  requireChatMemberMappingId,
  UNKNOWN_CHAT_MEMBER_ERROR,
} from "./chatMemberMapping.js";
import { emojisMatch, resolveConfigEmojiValue } from "./emojiFrequency.js";
import { getGuildConfigValue } from "./guildConfig.js";
import { normalizePinLogPayload } from "./pinHistory.js";
import {
  checkAndMarkMilestones,
  computeEmojiFrequencyPerApp,
  computeEmojiTrackedGlobal,
  computeEmojiUsedGlobal,
  computePinTotal,
  computePlusPlusItemNegative,
  computePlusPlusItemPositive,
  computePlusPlusItemTotal,
  computePlusPlusVotesGlobal,
  computePlusPlusVotesPerApp,
  computeRepostGlobalTotal,
  computeRepostUserTotal,
  computeStickerTrackedGlobal,
  computeStickerUsedGlobal,
} from "./milestones.js";

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

/** @param {string} emoid @returns {boolean} true if this looks like a real Discord snowflake (custom emoji/sticker), not a unicode character. */
function isNumericEmoid(emoid) {
  return /^\d+$/.test(String(emoid));
}

/**
 * Ensure emoji_frequency has a per-guild row for this emoji/sticker; increment frequency.
 * If no row exists, insert one with frequency 1. Numeric (custom) ids are gracefully discarded
 * (no row written) unless guildId is a known guild (guild_info) — see reactionHandler.js's
 * mirror-image guard on the bot side for external/unknown-guild emoji.
 * @param {string} app - e.g. "discord"; emoji_frequency.app has no default, so this is required on insert.
 * @param {string} guildId
 * @param {string} [emojiType] - Type from request (e.g. 'emoji'); if missing, type is stored as null.
 * @returns {Promise<{ frequency: number|null, inserted: boolean }>} frequency is null if the row was discarded/not written (missing id/name, or unknown guild)
 * @private
 */
async function ensureAndIncrementEmoji(
  app,
  guildId,
  emojiId,
  emojiName,
  emojiAnimated,
  emojiType,
) {
  const id = String(emojiId ?? "");
  const name = String((emojiName ?? id) || "?");
  const gid = String(guildId ?? "").trim();
  const type =
    emojiType != null && String(emojiType).trim() !== ""
      ? String(emojiType).trim()
      : null;

  if (id.length === 0 || name.length === 0 || !gid) {
    return { frequency: null, inserted: false };
  }

  if (isNumericEmoid(id)) {
    const [knownGuild] = await db.query(
      "SELECT 1 FROM guild_info WHERE app = ? AND guild_id = ?",
      [app, gid],
    );
    if (!knownGuild || knownGuild.length === 0) {
      // Gracefully discard: custom emoji/sticker from a guild we don't know about.
      return { frequency: null, inserted: false };
    }
  }

  const [existing] = await db.query(
    "SELECT frequency FROM emoji_frequency WHERE app = ? AND guild_id = ? AND emoid = ?",
    [app, gid, id],
  );

  if (existing && existing.length > 0) {
    await db.query(
      "UPDATE emoji_frequency SET frequency = frequency + 1 WHERE app = ? AND guild_id = ? AND emoid = ?",
      [app, gid, id],
    );
    return { frequency: Number(existing[0].frequency) + 1, inserted: false };
  }

  // Unicode emoji have no sync path, so their catalog row is created lazily here; custom (numeric) ones never are.
  if (!isNumericEmoid(id)) {
    const [catalogRow] = await db.query("SELECT id FROM guild_emojis WHERE id = ?", [id]);
    if (!catalogRow || catalogRow.length === 0) {
      await db.query(
        "INSERT INTO guild_emojis (id, app, guild_id, type, name, animated) VALUES (?, NULL, NULL, ?, ?, ?)",
        [id, type, name, emojiAnimated ? 1 : 0],
      );
    }
  }

  await db.query(
    "INSERT INTO emoji_frequency (app, guild_id, emoid, frequency, type) VALUES (?, ?, ?, 1, ?)",
    [app, gid, id, type],
  );
  return { frequency: 1, inserted: true };
}

/**
 * Upsert member_emoji_tracking. DB-agnostic: SELECT then INSERT or UPDATE.
 * @param {number} chatMemberMappingId - chat_member_mapping.id
 * @private
 */
async function upsertUserEmoji(chatMemberMappingId, emojiId) {
  if (chatMemberMappingId == null || !emojiId) return;

  const [rows] = await db.query(
    "SELECT frequency FROM member_emoji_tracking WHERE userid = ? AND emoid = ?",
    [chatMemberMappingId, emojiId],
  );

  if (rows && rows.length > 0) {
    await db.query(
      "UPDATE member_emoji_tracking SET frequency = frequency + 1 WHERE userid = ? AND emoid = ?",
      [chatMemberMappingId, emojiId],
    );
  } else {
    await db.query(
      "INSERT INTO member_emoji_tracking (userid, emoid, frequency) VALUES (?, ?, 1)",
      [chatMemberMappingId, emojiId],
    );
  }
}

/**
 * @param {{ id?: unknown, name?: unknown }} e - one entry from a countEmoji payload's `emojis` array
 * @param {string} app
 * @returns {{ app: string, emoid: string, emoji: string }}
 * @private
 */
function toEmojiObject(e, app) {
  const name = String(e?.name ?? "");
  return {
    app,
    emoid: e?.id != null ? String(e.id) : name,
    emoji: name,
  };
}

/**
 * Record emoji usage from a message. Optionally records a +/- vote when replying with one plus/minus emoji.
 * @param {object} payload - { app: string, guildId: string, authorId: string (snowflake), emojis: Array<{ name, id? }>, isReply?, repliedUserId? }
 * @returns {Promise<{ ok: boolean, applied?: string, error?: string, milestones?: Array }>}
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

  const guildId = String(payload.guildId ?? "").trim();
  if (!guildId) return { ok: false, error: "guildId is required" };

  // plusplus_emoji/minusminus_emoji are per-guild (guild_config), resolved into emoji objects
  // (see resolveConfigEmojiValue) so freeform/never-synced values still compare correctly.
  const [plusValue, minusValue] = await Promise.all([
    getGuildConfigValue(chatApp, guildId, "plusplus_emoji"),
    getGuildConfigValue(chatApp, guildId, "minusminus_emoji"),
  ]);
  const plusEmoji = await resolveConfigEmojiValue(chatApp, guildId, plusValue);
  const minusEmoji = await resolveConfigEmojiValue(chatApp, guildId, minusValue);

  if (!authorId || !Array.isArray(emojis) || emojis.length === 0) {
    return { ok: false };
  }

  const plusCount = emojis.filter((e) => emojisMatch(toEmojiObject(e, chatApp), plusEmoji)).length;
  const minusCount = emojis.filter((e) => emojisMatch(toEmojiObject(e, chatApp), minusEmoji)).length;

  const doPlusMinus = isReply && repliedUserId && plusCount + minusCount === 1;

  if (doPlusMinus && plusCount === 1) {
    const result = await recordPlusPlus(
      repliedUserId,
      "user",
      authorId,
      1,
      chatApp,
    );
    if (!result.ok) return { ok: false, error: UNKNOWN_CHAT_MEMBER_ERROR };
    return { ok: true, applied: "plus", milestones: result.milestones };
  }
  if (doPlusMinus && minusCount === 1) {
    const result = await recordPlusPlus(
      repliedUserId,
      "user",
      authorId,
      -1,
      chatApp,
    );
    if (!result.ok) return { ok: false, error: UNKNOWN_CHAT_MEMBER_ERROR };
    return { ok: true, applied: "minus", milestones: result.milestones };
  }

  const authorMap = await requireChatMemberMappingId(authorId, chatApp);
  if (!authorMap.ok) return { ok: false, error: authorMap.error };

  const milestones = [];
  for (const em of emojis) {
    const name = String(em.name ?? "?");
    const id = em.id != null ? String(em.id) : name;
    const isSticker = String(em.type ?? "").trim() === "sticker";
    const { frequency, inserted } = await ensureAndIncrementEmoji(
      chatApp,
      guildId,
      id,
      name,
      em.animated,
      em.type,
    );
    if (id && authorId) {
      await upsertUserEmoji(authorMap.id, id);
    }
    if (frequency != null) {
      milestones.push(
        ...(await checkAllEmojiMilestones({ chatApp, id, frequency, inserted, isSticker })),
      );
    }
  }
  return { ok: true, milestones };
}

/**
 * Run every milestone check relevant to one counted emoji/sticker occurrence.
 * @private
 */
async function checkAllEmojiMilestones({ chatApp, id, frequency, inserted, isSticker }) {
  const hits = [];

  const itemHit = await checkAndMarkMilestones({
    type: "emoji_frequency_item",
    item: id,
    value: frequency,
  });
  if (itemHit) hits.push(itemHit);

  const perAppTotal = await computeEmojiFrequencyPerApp(chatApp);
  const perAppHit = await checkAndMarkMilestones({
    type: "emoji_frequency_per_app",
    item: chatApp,
    value: perAppTotal,
  });
  if (perAppHit) hits.push(perAppHit);

  const usedValue = isSticker
    ? await computeStickerUsedGlobal()
    : await computeEmojiUsedGlobal();
  const usedHit = await checkAndMarkMilestones({
    type: isSticker ? "sticker_used_global" : "emoji_used_global",
    item: null,
    value: usedValue,
  });
  if (usedHit) hits.push(usedHit);

  if (inserted) {
    const trackedValue = isSticker
      ? await computeStickerTrackedGlobal()
      : await computeEmojiTrackedGlobal();
    const trackedHit = await checkAndMarkMilestones({
      type: isSticker ? "sticker_tracked_global" : "emoji_tracked_global",
      item: null,
      value: trackedValue,
    });
    if (trackedHit) hits.push(trackedHit);
  }

  return hits;
}

/**
 * Record sticker usage from a message. No plus/minus concept for stickers (Discord has no
 * reply-with-sticker vote mechanism), so this is simpler than countEmoji.
 * @param {object} payload - { app: string, authorId: string (snowflake), stickers: Array<{ name, id? }> }
 * @returns {Promise<{ ok: boolean, error?: string, milestones?: Array }>}
 */
export async function countSticker(payload) {
  const appCheck = requireChatAppFromPayload(payload);
  if (!appCheck.ok) return appCheck;
  const chatApp = appCheck.app;

  const { authorId, stickers = [] } = payload;
  const guildId = String(payload.guildId ?? "").trim();
  if (!guildId) return { ok: false, error: "guildId is required" };

  if (!authorId || !Array.isArray(stickers) || stickers.length === 0) {
    return { ok: false };
  }

  const authorMap = await requireChatMemberMappingId(authorId, chatApp);
  if (!authorMap.ok) return { ok: false, error: authorMap.error };

  const milestones = [];
  for (const st of stickers) {
    const name = String(st.name ?? "?");
    const id = st.id != null ? String(st.id) : name;
    const { frequency, inserted } = await ensureAndIncrementEmoji(
      chatApp,
      guildId,
      id,
      name,
      false,
      "sticker",
    );
    if (id && authorId) {
      await upsertUserEmoji(authorMap.id, id);
    }
    if (frequency != null) {
      milestones.push(
        ...(await checkAllEmojiMilestones({
          chatApp,
          id,
          frequency,
          inserted,
          isSticker: true,
        })),
      );
    }
  }
  return { ok: true, milestones };
}

// --- Plus/minus in messages ---

/**
 * Run every milestone check relevant to one recorded plusplus vote. `target` must be the
 * pre-resolution value (word text or the target's own platform snowflake), not an internal
 * chat_member_mapping id, since that's what milestone `item` values are defined against.
 * @private
 */
async function checkAllPlusPlusMilestones({ typestr, target, value, chatApp }) {
  const hits = [];

  const globalTotal = await computePlusPlusVotesGlobal();
  const globalHit = await checkAndMarkMilestones({
    type: "plusplus_votes_global",
    item: null,
    value: globalTotal,
  });
  if (globalHit) hits.push(globalHit);

  const perAppTotal = await computePlusPlusVotesPerApp(chatApp);
  const perAppHit = await checkAndMarkMilestones({
    type: "plusplus_votes_per_app",
    item: chatApp,
    value: perAppTotal,
  });
  if (perAppHit) hits.push(perAppHit);

  const itemTotal = await computePlusPlusItemTotal(target, typestr, chatApp);
  const itemHit = await checkAndMarkMilestones({
    type: "plusplus_item_total",
    item: String(target),
    value: itemTotal,
  });
  if (itemHit) hits.push(itemHit);

  const signedType = value === 1 ? "plusplus_item_positive" : "plusplus_item_negative";
  const signedValue =
    value === 1
      ? await computePlusPlusItemPositive(target, typestr, chatApp)
      : await computePlusPlusItemNegative(target, typestr, chatApp);
  const signedHit = await checkAndMarkMilestones({
    type: signedType,
    item: String(target),
    value: signedValue,
  });
  if (signedHit) hits.push(signedHit);

  return hits;
}

/**
 * @param {string} target - word text, or target user snowflake when typestr is 'user'
 * @param {'word'|'user'} typestr
 * @param {string} voterDiscordId - voter snowflake
 * @param {number} value - 1 or -1
 * @param {string} chatApp - e.g. "discord"
 * @returns {Promise<{ ok: boolean, milestones: Array }>} ok:false if mapping missing or invalid
 */
async function recordPlusPlus(target, typestr, voterDiscordId, value, chatApp) {
  if (!typestr || !voterDiscordId) return { ok: false, milestones: [] };
  if (typestr === "user" && String(target) === String(voterDiscordId))
    return { ok: false, milestones: [] };

  const voterRes = await requireChatMemberMappingId(voterDiscordId, chatApp);
  if (!voterRes.ok) return { ok: false, milestones: [] };

  if (typestr === "word") {
    if (!target || String(target).trim() === "") return { ok: false, milestones: [] };
    await db.query(
      "INSERT INTO plusplus_tracking (type, string, voter, value) VALUES (?, ?, ?, ?)",
      ["word", String(target), voterRes.id, value],
    );
    const milestones = await checkAllPlusPlusMilestones({ typestr, target, value, chatApp });
    return { ok: true, milestones };
  }

  const targetRes = await requireChatMemberMappingId(target, chatApp);
  if (!targetRes.ok) return { ok: false, milestones: [] };

  await db.query(
    "INSERT INTO plusplus_tracking (type, string, voter, value) VALUES (?, ?, ?, ?)",
    ["user", String(targetRes.id), voterRes.id, value],
  );
  const milestones = await checkAllPlusPlusMilestones({ typestr, target, value, chatApp });
  return { ok: true, milestones };
}

/**
 * Parse message for word++ / user++ / -- and record votes. A reply consisting of just "++"/"--"
 * has no preceding word/mention for the regex below to match, so that case is treated as a
 * single vote on the replied-to user instead.
 * @param {object} payload - { app: string, message: { content, author: { id } }, voterId: string (snowflake), isReply?: boolean, repliedUserId?: string }
 * @returns {Promise<{ ok: boolean, recorded?: number, error?: string, milestones?: Array }>}
 */
export async function recordPlusMinusMessage(payload) {
  const appCheck = requireChatAppFromPayload(payload);
  if (!appCheck.ok) return appCheck;
  const chatApp = appCheck.app;

  const { message, voterId, isReply = false, repliedUserId = null } = payload;
  const content = String(message?.content ?? "");
  if (!voterId) return { ok: false, error: "voterId is required" };

  const voterOk = await requireChatMemberMappingId(voterId, chatApp);
  if (!voterOk.ok) return { ok: false, error: voterOk.error };

  const trimmed = content.trim();
  if (isReply && repliedUserId && (trimmed === "++" || trimmed === "--")) {
    const result = await recordPlusPlus(
      repliedUserId,
      "user",
      voterId,
      trimmed === "++" ? 1 : -1,
      chatApp,
    );
    if (!result.ok) return { ok: false, error: UNKNOWN_CHAT_MEMBER_ERROR };
    return { ok: true, recorded: 1, milestones: result.milestones };
  }

  // Cap total +/- characters so one message can't cast a pile of votes at once.
  const plusMinusCharCount = (content.match(/[+-]/g) ?? []).length;
  if (plusMinusCharCount > 2) {
    return { ok: true, recorded: 0, milestones: [] };
  }

  const regex = /(\S+)\s*(\+\+|\-\-)/g;

  let match;
  const matches = [];
  while ((match = regex.exec(content)) !== null) {
    matches.push({ target: match[1], type: match[2] });
  }

  const mentionRegex = /^<@!?(\d+)>$/;
  let recorded = 0;
  const milestones = [];

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
      const result = await recordPlusPlus(target, matchtype, voterId, 1, chatApp);
      if (result.ok) {
        recorded++;
        milestones.push(...result.milestones);
      }
    } else if (m.type === "--" && matchtype) {
      const result = await recordPlusPlus(target, matchtype, voterId, -1, chatApp);
      if (result.ok) {
        recorded++;
        milestones.push(...result.milestones);
      }
    }
  }
  return { ok: true, recorded, milestones };
}

/**
 * Record a single plus or minus from a reaction. Writes to plusplus_tracking (type='user'). Self-votes are rejected.
 * @param {object} payload - { app: string, targetUserId: string, reactorId: string, value: 1 | -1 } (snowflakes)
 * @returns {Promise<{ ok: boolean, recorded?: number, value?: number, error?: string, milestones?: Array }>}
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
  const result = await recordPlusPlus(
    String(targetUserId),
    "user",
    String(reactorId),
    value,
    chatApp,
  );
  if (!result.ok) return { ok: false, error: UNKNOWN_CHAT_MEMBER_ERROR };
  return { ok: true, recorded: 1, value, milestones: result.milestones };
}

// --- Repost tracking ---

/**
 * Record or withdraw a repost accusation.
 * @param {object} payload - { app: string, userid, msgid, accuser (snowflakes), msgcontents?, repost: 1 | -1 }
 * @returns {Promise<{ ok: boolean, action?: string, deleted?: number, error?: string, milestones?: Array }>}
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
      "SELECT 1 FROM member_repost_tracking WHERE userid = ? AND msgid = ? AND accuser = ?",
      [authorId, msgid, accuserId],
    );
    if (existing && existing.length > 0) {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await db.query(
        "UPDATE member_repost_tracking SET msgcontents = ?, timestamp = ? WHERE userid = ? AND msgid = ? AND accuser = ?",
        [msgcontents || null, now, authorId, msgid, accuserId],
      );
    } else {
      await db.query(
        "INSERT INTO member_repost_tracking (userid, msgid, accuser, msgcontents) VALUES (?, ?, ?, ?)",
        [authorId, msgid, accuserId, msgcontents || null],
      );
    }

    const milestones = [];
    const userTotal = await computeRepostUserTotal(userid, chatApp);
    const userHit = await checkAndMarkMilestones({
      type: "repost_user_total",
      item: String(userid),
      value: userTotal,
    });
    if (userHit) milestones.push(userHit);

    const globalTotal = await computeRepostGlobalTotal();
    const globalHit = await checkAndMarkMilestones({
      type: "repost_global_total",
      item: null,
      value: globalTotal,
    });
    if (globalHit) milestones.push(globalHit);

    return { ok: true, action: "created", milestones };
  }

  if (repost === -1) {
    const [result] = await db.query(
      "DELETE FROM member_repost_tracking WHERE msgid = ? AND accuser = ?",
      [msgid, accuserId],
    );
    const deleted = result?.affectedRows ?? result?.changes ?? 0;
    return { ok: true, action: "withdrawn", deleted, milestones: [] };
  }

  return { ok: false };
}

// --- Guild emoji / sticker catalog (emoji_frequency; type = 'emoji' | 'sticker') ---

/**
 * Sync guild custom emojis or stickers into `emoji_frequency`.
 * Rows are distinguished by `emoji_frequency.type`: `"emoji"` or `"sticker"` (not Discord API subtype).
 * Deletes only zero-frequency rows of the same asset kind (and app), then inserts missing ids with frequency 0.
 * @param {Array<{ id: string, name: string, animated?: boolean }>} items - From guild.emojis / guild.stickers
 * @param {"emoji"|"sticker"} assetKind
 * @param {string} app - e.g. "discord"; emoji_frequency.app has no default, so this is required on insert.
 * @returns {Promise<{ ok: boolean, imported?: number }>} imported = new rows added (existing emoids skipped)
 */
/**
 * Fully replace this guild's custom emoji/sticker catalog in guild_emojis (mirrors
 * guildInfo.js's upsertGuildSnapshot delete+insert for channels/roles). Gracefully discards the
 * whole sync if guildId isn't a known guild (guild_info) — see reactionHandler.js's mirror-image
 * guard on the bot side. Usage counts in emoji_frequency are untouched; they're created lazily by
 * ensureAndIncrementEmoji on first actual use, and survive a catalog entry disappearing here.
 * @param {Array<{id?: string, name?: string, animated?: boolean, available?: boolean|null, managed?: boolean|null, requiresColons?: boolean|null, roles?: string[]}>} items
 * @param {"emoji"|"sticker"} assetKind
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<{ ok: boolean, imported?: number }>} imported = catalog rows written this sync
 */
export async function importGuildAssetFrequencyList(items, assetKind, app, guildId) {
  if (!Array.isArray(items)) return { ok: false };
  if (assetKind !== "emoji" && assetKind !== "sticker") return { ok: false };
  if (!isChatMemberAppSupported(app)) return { ok: false };
  const gid = String(guildId ?? "").trim();
  if (!gid) return { ok: false };

  const [knownGuild] = await db.query(
    "SELECT 1 FROM guild_info WHERE app = ? AND guild_id = ?",
    [app, gid],
  );
  if (!knownGuild || knownGuild.length === 0) {
    // Gracefully discard: don't create catalog entries for a guild we don't know about.
    return { ok: true, imported: 0 };
  }

  const list = items.filter(
    (e) => e != null && (e.id != null || e.name != null),
  );

  // Carry frequency forward across the delete+insert replace below, or every restart would reset it to 0.
  const [existingRows] = await db.query(
    "SELECT id, frequency FROM guild_emojis WHERE app = ? AND guild_id = ? AND type = ?",
    [app, gid, assetKind],
  );
  const frequencyById = new Map(
    (existingRows ?? []).map((r) => [r.id, Number(r.frequency) || 0]),
  );

  // Scoped by (app, guild_id, type) so replacing one kind's catalog never touches the other's.
  await db.query("DELETE FROM guild_emojis WHERE app = ? AND guild_id = ? AND type = ?", [
    app,
    gid,
    assetKind,
  ]);

  let imported = 0;
  for (const e of list) {
    const id = String(e.id ?? "").trim();
    const name = String((e.name ?? id) || "?").trim();
    if (id.length === 0 && name === "?") continue;
    const emoid = id || name;

    await db.query(
      `INSERT INTO guild_emojis (id, app, guild_id, type, name, animated, available, managed, requires_colons, roles, frequency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        emoid,
        app,
        gid,
        assetKind,
        name,
        e.animated ? 1 : 0,
        e.available == null ? null : e.available ? 1 : 0,
        e.managed == null ? null : e.managed ? 1 : 0,
        e.requiresColons == null ? null : e.requiresColons ? 1 : 0,
        Array.isArray(e.roles) && e.roles.length > 0 ? JSON.stringify(e.roles) : null,
        frequencyById.get(emoid) ?? 0,
      ],
    );
    imported++;
  }
  return { ok: true, imported };
}

/**
 * List guild_emojis emoji rows that carry a guild_id (custom emoji, not unicode), for the
 * emoji-cleanup admin script (discord-bot/scripts/cleanup-guild-emojis.js) to verify against
 * each guild's live Discord emoji list. `sourceFrequency` is the emoji_frequency total that
 * migrateEmojiCatalogFrequency would write into `frequency`, for the script's dry-run preview.
 * @param {string} app
 * @returns {Promise<Array<{id: string, guildId: string, name: string, animated: boolean, frequency: number, sourceFrequency: number}>>}
 */
export async function listEmojiCatalogWithGuild(app) {
  const [rows] = await db.query(
    `SELECT ge.id, ge.guild_id, ge.name, ge.animated, ge.frequency,
            (SELECT COALESCE(SUM(ef.frequency), 0) FROM emoji_frequency ef WHERE ef.emoid = ge.id AND ef.app = ge.app) AS source_frequency
     FROM guild_emojis ge
     WHERE ge.app = ? AND ge.guild_id IS NOT NULL AND ge.type = 'emoji'
     ORDER BY ge.guild_id, ge.name`,
    [app],
  );
  return (rows ?? []).map((r) => ({
    id: r.id,
    guildId: r.guild_id,
    name: r.name,
    animated: Boolean(r.animated),
    frequency: Number(r.frequency) || 0,
    sourceFrequency: Number(r.source_frequency) || 0,
  }));
}

/**
 * Delete one guild_emojis emoji row by id (used by the emoji-cleanup admin script to remove
 * rows misattributed to a guild they don't actually belong to).
 * @param {string} id
 * @returns {Promise<boolean>} true if a row was deleted
 */
export async function deleteEmojiCatalogRow(id) {
  if (!id || String(id).trim() === "") return false;
  const [result] = await db.query(
    "DELETE FROM guild_emojis WHERE id = ? AND type = 'emoji'",
    [String(id).trim()],
  );
  return (result?.affectedRows ?? 0) > 0;
}

/**
 * Migrate one emoji's usage total from emoji_frequency into guild_emojis.frequency, keyed by
 * emoid. Only writes when the row is still present in guild_emojis (i.e. the emoji-cleanup
 * script's stale-row deletion has already run) — recomputes the sum server-side rather than
 * trusting a client-supplied total.
 * @param {string} id
 * @returns {Promise<{ok: boolean, frequency?: number, error?: string}>}
 */
export async function migrateEmojiCatalogFrequency(id) {
  if (!id || String(id).trim() === "") return { ok: false, error: "id is required" };
  const trimmedId = String(id).trim();

  const [catalogRows] = await db.query(
    "SELECT app FROM guild_emojis WHERE id = ? AND type = 'emoji'",
    [trimmedId],
  );
  if (!catalogRows || catalogRows.length === 0) {
    return { ok: false, error: "Emoji not found in guild_emojis" };
  }
  const app = catalogRows[0].app;

  const [sumRows] = await db.query(
    "SELECT COALESCE(SUM(frequency), 0) AS total FROM emoji_frequency WHERE emoid = ? AND app = ?",
    [trimmedId, app],
  );
  const total = Number(sumRows?.[0]?.total ?? 0);

  await db.query(
    "UPDATE guild_emojis SET frequency = ? WHERE id = ? AND type = 'emoji'",
    [total, trimmedId],
  );
  return { ok: true, frequency: total };
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
 * @param {{ messageId?: string, app?: string, authorId?: string, contents?: string, attachments?: unknown, channelId?: string, channelName?: string, pinnerIds?: string[] }} payload
 * @returns {Promise<{ ok: boolean, error?: string, milestones?: Array }>}
 */
export async function logPinnedMessage(payload) {
  const messageId =
    typeof payload === "string" ? payload : payload?.messageId;
  if (!messageId || String(messageId).trim() === "") {
    return { ok: false };
  }
  const id = String(messageId).trim();
  const already = await isMessageAlreadyPinned(id);
  if (already) return { ok: true, milestones: [] };

  const appCheck = requireChatAppFromPayload(
    typeof payload === "object" && payload != null ? payload : {},
  );
  if (!appCheck.ok) return appCheck;

  const normalized = await normalizePinLogPayload(payload, appCheck.app);
  if (!normalized.ok) return normalized;

  const { author, contents, attachments, channelId, channelName, pinners } =
    normalized.row;

  await db.query(
    `INSERT INTO pin_history (
      msgid, author, contents, attachments, channel_id, channel_name, pinners, hydrated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, author, contents, attachments, channelId, channelName, pinners, 1],
  );

  const milestones = [];
  const total = await computePinTotal();
  const hit = await checkAndMarkMilestones({ type: "pin_total", item: null, value: total });
  if (hit) milestones.push(hit);

  return { ok: true, milestones };
}
