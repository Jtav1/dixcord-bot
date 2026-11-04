import { apiFetch, apiFetchJson } from "./http.js";

/** Max react-role posts per server; mirrors MAX_MESSAGES_PER_GUILD in webapi/routes/react-role.js. */
export const MAX_REACT_ROLE_MESSAGES = 10;

/**
 * List a server's react-for-role messages, oldest first.
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<object[]>}
 */
export async function fetchReactRoleMessages(app, guildId) {
  const params = new URLSearchParams({ app, guildId });
  const data = await apiFetch(`/react-role?${params}`, undefined, "React-for-role messages");
  return data.messages ?? [];
}

/**
 * Fetch one react-for-role message, or null if it no longer exists.
 * @param {string} app
 * @param {string} guildId
 * @param {number} id
 * @returns {Promise<object|null>}
 */
export async function fetchReactRoleMessage(app, guildId, id) {
  const messages = await fetchReactRoleMessages(app, guildId);
  return messages.find((m) => m.id === id) ?? null;
}

/**
 * Create a react-for-role message. The live Discord/Fluxer message is posted asynchronously by
 * the bot, not by this request.
 * @param {string} app
 * @param {string} guildId
 * @param {{channelId:string, title:string, description?:string, bindings:Array<{emoji:string, roleId:string, description:string}>}} fields
 * @returns {Promise<object>}
 */
export async function createReactRoleMessage(app, guildId, fields) {
  const data = await apiFetchJson(
    "POST",
    "/react-role",
    { app, guildId, ...fields },
    "React-for-role create",
  );
  return data.message;
}

/**
 * Update a react-for-role message; the bot re-syncs the live message asynchronously.
 * @param {string} app
 * @param {string} guildId
 * @param {number} id
 * @param {{channelId:string, title:string, description?:string, bindings:Array<{emoji:string, roleId:string, description:string}>}} fields
 * @returns {Promise<object>}
 */
export async function updateReactRoleMessage(app, guildId, id, fields) {
  const data = await apiFetchJson(
    "PUT",
    `/react-role/${id}`,
    { app, guildId, ...fields },
    "React-for-role save",
  );
  return data.message;
}

/**
 * Soft-delete a react-for-role message; the bot removes the live message and the row is then
 * hard-deleted.
 * @param {string} app
 * @param {string} guildId
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteReactRoleMessage(app, guildId, id) {
  await apiFetchJson("DELETE", `/react-role/${id}`, { app, guildId }, "React-for-role delete");
}

/**
 * Poll until the bot has synced the live message to `contentVersion` (a save just made), it
 * reports a failure for that same version, or the timeout elapses. The bot reconciles every few
 * seconds (see discord-bot/fluxer-bot's reactRoleSync.js), so this gives the admin a near-immediate
 * success/failure signal instead of the old fire-and-forget "saved, will update shortly" toast.
 * @param {string} app
 * @param {string} guildId
 * @param {number} id
 * @param {number} contentVersion
 * @param {{intervalMs?:number, timeoutMs?:number}} [opts]
 * @returns {Promise<{status:"synced"} | {status:"failed", error:string} | {status:"pending"}>} "pending" means the timeout elapsed with no result yet — not itself a failure.
 */
export async function waitForReactRoleSync(app, guildId, id, contentVersion, opts = {}) {
  const intervalMs = opts.intervalMs ?? 1500;
  const timeoutMs = opts.timeoutMs ?? 15000;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const message = await fetchReactRoleMessage(app, guildId, id);
    if (message?.syncedVersion === contentVersion) return { status: "synced" };
    if (message?.lastSyncErrorVersion === contentVersion && message.lastSyncError) {
      return { status: "failed", error: message.lastSyncError };
    }
    if (Date.now() >= deadline) return { status: "pending" };
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
