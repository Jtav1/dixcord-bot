/**
 * React-for-role: any number of live reaction-role messages per (app, guild_id), each with its
 * own emoji->role bindings. Admin writes bump content_version; the bot bumps synced_version once
 * it has posted/edited the live message to match (see routes/react-role.js for the reconciliation
 * flow). Every per-message function is scoped by (id, app, guildId) so one guild can never touch
 * another's rows.
 */

import db from "../config/db.js";

/**
 * @param {number} id react_role_messages.id
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<object|null>} Raw react_role_messages row, or null.
 */
async function getMessageRow(id, app, guildId) {
  const [rows] = await db.query(
    "SELECT * FROM react_role_messages WHERE id = ? AND app = ? AND guild_id = ?",
    [id, app, guildId],
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
 * @param {number} id
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<object|null>} Message + bindings in API shape, or null if not found.
 */
export async function getMessageWithBindings(id, app, guildId) {
  const row = await getMessageRow(id, app, guildId);
  if (!row) return null;
  const bindings = await getBindings(row.id);
  return toApiShape(row, bindings);
}

/**
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<Array<object>>} All of the guild's messages + bindings in API shape, oldest first.
 */
export async function listMessagesWithBindings(app, guildId) {
  const [rows] = await db.query(
    "SELECT * FROM react_role_messages WHERE app = ? AND guild_id = ? ORDER BY id",
    [app, guildId],
  );
  const list = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    list.push(toApiShape(row, await getBindings(row.id)));
  }
  return list;
}

/**
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<number>} How many messages the guild has (including ones pending delete).
 */
export async function countMessages(app, guildId) {
  const [rows] = await db.query(
    "SELECT COUNT(*) AS total FROM react_role_messages WHERE app = ? AND guild_id = ?",
    [app, guildId],
  );
  return Number(rows?.[0]?.total ?? 0);
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
 * Replace a message's bindings.
 * @param {number} messageRowId
 * @param {Array<{emoji:string, roleId:string, description:string}>} bindings
 */
async function insertBindings(messageRowId, bindings) {
  let sortOrder = 0;
  for (const binding of bindings) {
    await db.query(
      "INSERT INTO react_role_bindings (message_id, emoji, role_id, description, sort_order) VALUES (?, ?, ?, ?, ?)",
      [messageRowId, binding.emoji, binding.roleId, binding.description, sortOrder],
    );
    sortOrder += 1;
  }
}

/**
 * Create a new message (content_version = 1). Caller (the route) validates the bindings and the
 * per-guild message cap beforehand.
 * @param {string} app
 * @param {string} guildId
 * @param {{channelId:string, title:string, description?:string, bindings:Array<{emoji:string, roleId:string, description:string}>}} fields
 * @returns {Promise<object>} Message + bindings in API shape.
 */
export async function createMessage(app, guildId, { channelId, title, description, bindings }) {
  const [result] = await db.query(
    "INSERT INTO react_role_messages (app, guild_id, channel_id, title, description) VALUES (?, ?, ?, ?, ?)",
    [app, guildId, channelId, title, description ?? null],
  );
  const id = result?.insertId ?? result?.lastInsertRowid;
  await insertBindings(id, bindings);
  return getMessageWithBindings(Number(id), app, guildId);
}

/**
 * Update a message: bumps content_version and fully replaces the bindings.
 * @param {number} id
 * @param {string} app
 * @param {string} guildId
 * @param {{channelId:string, title:string, description?:string, bindings:Array<{emoji:string, roleId:string, description:string}>}} fields
 * @returns {Promise<object|null>} Message + bindings in API shape, or null if not found.
 */
export async function updateMessage(id, app, guildId, { channelId, title, description, bindings }) {
  const existing = await getMessageRow(id, app, guildId);
  if (!existing) return null;
  // Clear any stale failure from a previous version — this write starts a fresh attempt.
  await db.query(
    "UPDATE react_role_messages SET channel_id = ?, title = ?, description = ?, content_version = content_version + 1, last_sync_error = NULL, last_sync_error_version = NULL WHERE id = ?",
    [channelId, title, description ?? null, existing.id],
  );
  await db.query("DELETE FROM react_role_bindings WHERE message_id = ?", [existing.id]);
  await insertBindings(existing.id, bindings);
  return getMessageWithBindings(existing.id, app, guildId);
}

/**
 * Soft-delete: flags the message for the bot to remove from the live platform. Idempotent — a
 * no-op (returns false) if no such row exists.
 * @param {number} id
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<boolean>}
 */
export async function markPendingDelete(id, app, guildId) {
  const [result] = await db.query(
    "UPDATE react_role_messages SET pending_delete = 1 WHERE id = ? AND app = ? AND guild_id = ?",
    [id, app, guildId],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * Hard-delete the message row (cascades its bindings). Called by the bot once it has confirmed
 * the live platform message is gone.
 * @param {number} id
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<boolean>}
 */
export async function hardDeleteMessage(id, app, guildId) {
  const [result] = await db.query(
    "DELETE FROM react_role_messages WHERE id = ? AND app = ? AND guild_id = ?",
    [id, app, guildId],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * Called by the bot after it successfully posts or edits the live message. Clears any
 * previously recorded failure, since a success supersedes it.
 * @param {number} id
 * @param {string} app
 * @param {string} guildId
 * @param {{messageId:string, channelId:string, syncedVersion:number}} fields
 * @returns {Promise<boolean>}
 */
export async function markSynced(id, app, guildId, { messageId, channelId, syncedVersion }) {
  const [result] = await db.query(
    "UPDATE react_role_messages SET message_id = ?, channel_id = ?, synced_version = ?, last_sync_error = NULL, last_sync_error_version = NULL WHERE id = ? AND app = ? AND guild_id = ?",
    [messageId, channelId, syncedVersion, id, app, guildId],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}

/**
 * Called by the bot when it fails to post/edit the live message for a given content version, so
 * the admin panel can surface why a save didn't take effect. `contentVersion` is the version the
 * bot was attempting to sync to when it failed — the caller (the admin panel, polling GET) only
 * treats this as relevant if it still matches the row's current content_version.
 * @param {number} id
 * @param {string} app
 * @param {string} guildId
 * @param {{contentVersion:number, error:string}} fields
 * @returns {Promise<boolean>}
 */
export async function recordSyncFailure(id, app, guildId, { contentVersion, error }) {
  const [result] = await db.query(
    "UPDATE react_role_messages SET last_sync_error = ?, last_sync_error_version = ? WHERE id = ? AND app = ? AND guild_id = ?",
    [error, contentVersion, id, app, guildId],
  );
  return (result?.affectedRows ?? result?.changes ?? 0) > 0;
}
