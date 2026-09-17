/**
 * Vote-to-timeout: react enough times with a configured emoji and a message's author gets timed
 * out. `timeout_vote_tracking` is a mutable per-message vote ledger (rows added/removed as
 * reactions are added/removed) mirroring plusplus_tracking; `timeout_history` is the immutable
 * once-per-message record of a fired timeout, whose UNIQUE(message_id) is the idempotency guard
 * (mirrors pin_history.msgid) — once a row exists there, further votes on that message are no-ops
 * and the ledger stops accepting removals for it, so the historical voter list stays accurate.
 */

import db from "../config/db.js";
import { getChatMemberMappingIdByPlatformUserId } from "./chatMemberMapping.js";
import { getGuildConfigValue } from "./guildConfig.js";
import { parseLimit } from "./leaderboards.js";

const DEFAULT_RESPONSE_MESSAGE = "{user} has been timed out by community vote.";
const MAX_TIMEOUT_SECONDS = 24 * 60 * 60;

/**
 * @param {string} messageId
 * @returns {Promise<boolean>}
 */
async function hasAlreadyTriggered(messageId) {
  const [rows] = await db.query(
    "SELECT id FROM timeout_history WHERE message_id = ?",
    [messageId],
  );
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Record one reaction-add vote toward timing out a message's author. Idempotent per (message,
 * voter) — re-adding after a removal is a no-op vote count-wise, since the prior row is gone.
 * @param {{ app: string, guildId: string, messageId: string, targetPlatformId: string, voterPlatformId: string, weight: number }} params
 * @returns {Promise<{ ok: true, triggered: boolean, alreadyActioned?: boolean, currentWeight?: number, threshold?: number, targetPlatformId?: string, durationSeconds?: number, responseMessage?: string, voteWeightTotal?: number }>}
 */
export async function recordTimeoutVote({
  app,
  guildId,
  messageId,
  targetPlatformId,
  voterPlatformId,
  weight,
}) {
  const msgId = String(messageId);

  if (await hasAlreadyTriggered(msgId)) {
    return { ok: true, triggered: false, alreadyActioned: true };
  }

  const targetMappingId = await getChatMemberMappingIdByPlatformUserId(targetPlatformId, app);
  const voterMappingId = await getChatMemberMappingIdByPlatformUserId(voterPlatformId, app);
  const safeWeight = Math.max(1, Math.round(Number(weight) || 1));

  const [existingVote] = await db.query(
    "SELECT id FROM timeout_vote_tracking WHERE message_id = ? AND voter = ?",
    [msgId, voterMappingId],
  );
  if (!existingVote || existingVote.length === 0) {
    await db.query(
      "INSERT INTO timeout_vote_tracking (app, guild_id, message_id, target, voter, weight) VALUES (?, ?, ?, ?, ?, ?)",
      [app, guildId, msgId, targetMappingId, voterMappingId, safeWeight],
    );
  }

  const [sumRows] = await db.query(
    "SELECT COALESCE(SUM(weight), 0) AS total FROM timeout_vote_tracking WHERE message_id = ?",
    [msgId],
  );
  const currentWeight = Number(sumRows?.[0]?.total ?? 0);

  const threshold = parseInt(await getGuildConfigValue(app, guildId, "timeout_vote_threshold"), 10) || 0;
  if (threshold <= 0 || currentWeight < threshold) {
    return { ok: true, triggered: false, currentWeight, threshold };
  }

  // Narrow (not eliminate) the race window between two near-simultaneous votes both crossing
  // threshold: only the request whose INSERT into timeout_history actually lands "wins."
  if (await hasAlreadyTriggered(msgId)) {
    return { ok: true, triggered: false, alreadyActioned: true };
  }

  const durationSeconds = Math.min(
    MAX_TIMEOUT_SECONDS,
    Math.max(1, parseInt(await getGuildConfigValue(app, guildId, "timeout_vote_duration_seconds"), 10) || 300),
  );
  const responseMessage =
    (await getGuildConfigValue(app, guildId, "timeout_vote_response_message")) || DEFAULT_RESPONSE_MESSAGE;

  await db.query(
    "INSERT INTO timeout_history (app, guild_id, message_id, target, vote_weight_total, duration_seconds) VALUES (?, ?, ?, ?, ?, ?)",
    [app, guildId, msgId, targetMappingId, currentWeight, durationSeconds],
  );

  return {
    ok: true,
    triggered: true,
    targetPlatformId: String(targetPlatformId),
    durationSeconds,
    responseMessage,
    voteWeightTotal: currentWeight,
  };
}

/**
 * Un-count a reaction-remove vote. No-op once the message has already triggered a timeout, so the
 * historical voter list for a fired timeout stays accurate.
 * @param {{ app: string, messageId: string, voterPlatformId: string }} params
 * @returns {Promise<{ ok: true, removed: boolean }>}
 */
export async function removeTimeoutVote({ app, messageId, voterPlatformId }) {
  const msgId = String(messageId);
  if (await hasAlreadyTriggered(msgId)) {
    return { ok: true, removed: false };
  }

  const voterMappingId = await getChatMemberMappingIdByPlatformUserId(voterPlatformId, app);
  if (voterMappingId == null) return { ok: true, removed: false };

  const [result] = await db.query(
    "DELETE FROM timeout_vote_tracking WHERE message_id = ? AND voter = ?",
    [msgId, voterMappingId],
  );
  return { ok: true, removed: (result?.affectedRows ?? 0) > 0 };
}

/**
 * Paginated list of fired timeouts, newest first, for the webview leaderboard.
 * @param {{ app: string, limit?: number|string, offset?: number|string }} params
 * @returns {Promise<{ entries: Array<{ id: number, messageId: string, guildId: string, target: number|null, voteWeightTotal: number, durationSeconds: number, timestamp: string }>, total: number }>}
 */
export async function listTimeoutHistory({ app, limit, offset }) {
  const safeLimit = parseLimit(limit, 20, 100);
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

  const [countRows] = await db.query(
    "SELECT COUNT(*) AS total FROM timeout_history WHERE app = ?",
    [app],
  );
  const total = Number(countRows?.[0]?.total ?? 0);

  const [rows] = await db.query(
    `SELECT id, message_id AS messageId, guild_id AS guildId, target, vote_weight_total AS voteWeightTotal,
            duration_seconds AS durationSeconds, timestamp
     FROM timeout_history
     WHERE app = ?
     ORDER BY timestamp DESC
     LIMIT ? OFFSET ?`,
    [app, safeLimit, safeOffset],
  );

  const entries = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: Number(row.id),
    messageId: String(row.messageId),
    guildId: String(row.guildId),
    target: row.target == null ? null : Number(row.target),
    voteWeightTotal: Number(row.voteWeightTotal),
    durationSeconds: Number(row.durationSeconds),
    timestamp: row.timestamp,
  }));

  return { entries, total };
}

/**
 * Voters for one fired timeout event, resolved by its message id. `voter` is a
 * chat_member_mapping id (or null if unresolved) — webview resolves it to a display identity the
 * same way pin_history's author/pinners are resolved (see webview's buildIdentityMapByMappingId).
 * @param {number} historyId timeout_history.id
 * @returns {Promise<Array<{ voter: number|null, weight: number, timestamp: string }>>}
 */
export async function listTimeoutVotersForHistory(historyId) {
  const [historyRows] = await db.query(
    "SELECT message_id AS messageId FROM timeout_history WHERE id = ?",
    [historyId],
  );
  if (!historyRows || historyRows.length === 0) return [];
  const messageId = historyRows[0].messageId;

  const [rows] = await db.query(
    `SELECT voter, weight, timestamp
     FROM timeout_vote_tracking
     WHERE message_id = ?
     ORDER BY timestamp ASC`,
    [messageId],
  );

  return (Array.isArray(rows) ? rows : []).map((row) => ({
    voter: row.voter == null ? null : Number(row.voter),
    weight: Number(row.weight),
    timestamp: row.timestamp,
  }));
}
