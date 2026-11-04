/**
 * React-for-role: the one live reaction-role message per (app, guild_id), and its emoji->role
 * bindings. Admin writes bump content_version; the bot bumps synced_version once it has
 * posted/edited the live message to match (see routes/react-role.js for the reconciliation flow).
 */

import db from "../config/db.js";

/**
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<object|null>} Raw react_role_messages row, or null.
 */
async function getMessageRow(app, guildId) {
  const [rows] = await db.query(
    "SELECT * FROM react_role_messages WHERE app = ? AND guild_id = ?",
    [app, guildId],
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * @param {number} messageId react_role_messages.id
 * @returns {Promise<Array<{id:number, emoji:string, roleId:string, description:string, sortOrder:number}>>}
 */
async function getBindings(messageId) {
  const [rows] = await db.query(
    "SELECT id, emoji, role_id, description, sort_order FROM react_role_bindings WHERE message_id = ? ORDER BY sort_order, id",
    [messageId],
  );
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id,
    emoji: row.emoji,
    roleId: row.role_id,
    description: row.description,
    sortOrder: row.sort_order,
  }));
}

/**
 * @param {object} row Raw react_role_messages row.
 * @param {Array} bindings From getBindings.
 * @returns {object} Camel-cased shape returned to API consumers.
 */
function toApiShape(row, bindings) {
  return {
    id: row.id,
    app: row.app,
    guildId: row.guild_id,
    channelId: row.channel_id,
    messageId: row.message_id,
    title: row.title,
    description: row.description,
    contentVersion: row.content_version,
    syncedVersion: row.synced_version,
    pendingDelete: Boolean(row.pending_delete),
    lastSyncError: row.last_sync_error ?? null,
    lastSyncErrorVersion: row.last_sync_error_version ?? null,
    bindings,
  };
}

/**
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<object|null>} Message + bindings in API shape, or null if unconfigured.
 */
export async function getMessageWithBindings(app, guildId) {
  const row = await getMessageRow(app, guildId);
  if (!row) return null;
  const bindings = await getBindings(row.id);
  return toApiShape(row, bindings);
}

/**
 * @param {Array<{emoji:string, roleId:string}>} bindings
 * @returns {string|null} The first duplicate emoji value, or null if none.
 */
export function findDuplicateEmoji(bindings) {
  const seen = new Set();
  for (const binding of bindings) {
    if (seen.has(binding.emoji)) return binding.emoji;
    seen.add(binding.emoji);
  }
  return null;
}

/**
 * @param {Array<{emoji:string, roleId:string}>} bindings
 * @returns {string|null} The first duplicate role id, or null if none.
 */
export function findDuplicateRoleId(bindings) {
  const seen = new Set();
  for (const binding of bindings) {
    if (seen.has(binding.roleId)) return binding.roleId;
    seen.add(binding.roleId);
  }
  return null;
}

/**
 * Create-or-update the one react_role_messages row for (app, guildId): on update, bumps
 * content_version and fully replaces the bindings; on create, sets content_version = 1. Caller
 * (the route) is responsible for validating bindings beforehand (required fields, row cap,
 * duplicate emoji/role).
 * @param {string} app
 * @param {string} guildId
 * @param {{channelId:string, title:string, description?:string, bindings:Array<{emoji:string, roleId:string, description:string}>}} fields
 * @returns {Promise<object>} Message + bindings in API shape.
 */
export async function upsertMessage(app, guildId, { channelId, title, description, bindings }) {
  const existing = await getMessageRow(app, guildId);

  let messageRowId;
  if (existing) {
    // Clear any stale failure from a previous version — this write starts a fresh attempt.
    await db.query(
      "UPDATE react_role_messages SET channel_id = ?, title = ?, description = ?, content_version = content_version + 1, last_sync_error = NULL, last_sync_error_version = NULL WHERE id = ?",
      [channelId, title, description ?? null, existing.id],
    );
    await db.query("DELETE FROM react_role_bindings WHERE message_id = ?", [existing.id]);
    messageRowId = existing.id;
  } else {
    const [result] = await db.query(
      "INSERT INTO react_role_messages (app, guild_id, channel_id, title, description) VALUES (?, ?, ?, ?, ?)",
      [app, guildId, channelId, title, description ?? null],
    );
    messageRowId = result?.insertId ?? result?.lastInsertRowid;
  }

  let sortOrder = 0;
  for (const binding of bindings) {
    await db.query(
      "INSERT INTO react_role_bindings (message_id, emoji, role_id, description, sort_order) VALUES (?, ?, ?, ?, ?)",
      [messageRowId, binding.emoji, binding.roleId, binding.description, sortOrder],
    );
    sortOrder += 1;
  }

  return getMessageWithBindings(app, guildId);
}

/**
 * Soft-delete: flags the message for the bot to remove from the live platform. Idempotent — a
 * no-op (returns false) if no row exists for this (app, guildId).
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<boolean>}
 */
export async function markPendingDelete(app, guildId) {
  const [result] = await db.query(
    "UPDATE react_role_messages SET pending_delete = 1 WHERE app = ? AND guild_id = ?",
    [app, guildId],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * Hard-delete the message row (cascades its bindings). Called by the bot once it has confirmed
 * the live platform message is gone.
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<boolean>}
 */
export async function hardDeleteMessage(app, guildId) {
  const [result] = await db.query(
    "DELETE FROM react_role_messages WHERE app = ? AND guild_id = ?",
    [app, guildId],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * Called by the bot after it successfully posts or edits the live message. Clears any
 * previously recorded failure, since a success supersedes it.
 * @param {string} app
 * @param {string} guildId
 * @param {{messageId:string, channelId:string, syncedVersion:number}} fields
 * @returns {Promise<boolean>}
 */
export async function markSynced(app, guildId, { messageId, channelId, syncedVersion }) {
  const [result] = await db.query(
    "UPDATE react_role_messages SET message_id = ?, channel_id = ?, synced_version = ?, last_sync_error = NULL, last_sync_error_version = NULL WHERE app = ? AND guild_id = ?",
    [messageId, channelId, syncedVersion, app, guildId],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * Called by the bot when it fails to post/edit the live message for a given content version, so
 * the admin panel can surface why a save didn't take effect. `contentVersion` is the version the
 * bot was attempting to sync to when it failed — the caller (the admin panel, polling GET) only
 * treats this as relevant if it still matches the row's current content_version.
 * @param {string} app
 * @param {string} guildId
 * @param {{contentVersion:number, error:string}} fields
 * @returns {Promise<boolean>}
 */
export async function recordSyncFailure(app, guildId, { contentVersion, error }) {
  const [result] = await db.query(
    "UPDATE react_role_messages SET last_sync_error = ?, last_sync_error_version = ? WHERE app = ? AND guild_id = ?",
    [error, contentVersion, app, guildId],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
