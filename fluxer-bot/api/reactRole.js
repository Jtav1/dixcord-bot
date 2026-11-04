/**
 * Web API client for the react-for-role feature: lists the configured messages for this bot's
 * guild, and reports back (per message id) once a live message has been posted/edited/removed.
 */

import * as api from "./client.js";
import { guildId } from "../configVars.js";

/**
 * GET /api/react-role?app=fluxer&guildId=<this bot's guild>
 * @returns {Promise<object[]>} Messages + bindings (camelCased), oldest first; empty if none.
 */
export async function listReactRoleMessages() {
  const { data } = await api.get("/api/react-role", {
    params: { app: "fluxer", guildId },
  });
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load react-for-role messages");
  }
  return data.messages ?? [];
}

/**
 * POST /api/react-role/:id/synced — call after successfully posting or editing the live message.
 * @param {number} id react_role_messages row id
 * @param {{messageId:string, channelId:string, syncedVersion:number}} fields
 * @returns {Promise<void>}
 */
export async function markReactRoleSynced(id, { messageId, channelId, syncedVersion }) {
  const { data } = await api.post(`/api/react-role/${id}/synced`, {
    app: "fluxer",
    guildId,
    messageId,
    channelId,
    syncedVersion,
  });
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to record react-for-role sync");
  }
}

/**
 * POST /api/react-role/:id/sync-failed — call after a post/edit attempt fails, so the admin panel
 * can surface why a save didn't take effect.
 * @param {number} id react_role_messages row id
 * @param {{contentVersion:number, error:string}} fields
 * @returns {Promise<void>}
 */
export async function reportReactRoleSyncFailed(id, { contentVersion, error }) {
  const { data } = await api.post(`/api/react-role/${id}/sync-failed`, {
    app: "fluxer",
    guildId,
    contentVersion,
    error,
  });
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to report react-for-role sync failure");
  }
}

/**
 * POST /api/react-role/:id/confirm-delete — call after confirming the live message is gone.
 * @param {number} id react_role_messages row id
 * @returns {Promise<void>}
 */
export async function confirmReactRoleDelete(id) {
  const { data } = await api.post(`/api/react-role/${id}/confirm-delete`, {
    app: "fluxer",
    guildId,
  });
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to confirm react-for-role deletion");
  }
}
