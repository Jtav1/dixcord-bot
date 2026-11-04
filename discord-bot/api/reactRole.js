/**
 * Web API client for the react-for-role feature: reads the one configured message for this
 * bot's guild, and reports back once the live message has been posted/edited/removed to match.
 */

import * as api from "./client.js";
import { guildId } from "../configVars.js";

/**
 * GET /api/react-role?app=discord&guildId=<this bot's guild>
 * @returns {Promise<object|null>} Message + bindings (camelCased), or null if unconfigured.
 */
export async function getReactRoleMessage() {
  const { data } = await api.get("/api/react-role", {
    params: { app: "discord", guildId },
  });
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load react-for-role message");
  }
  return data.message ?? null;
}

/**
 * POST /api/react-role/synced — call after successfully posting or editing the live message.
 * @param {{messageId:string, channelId:string, syncedVersion:number}} fields
 * @returns {Promise<void>}
 */
export async function markReactRoleSynced({ messageId, channelId, syncedVersion }) {
  const { data } = await api.post("/api/react-role/synced", {
    app: "discord",
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
 * POST /api/react-role/sync-failed — call after a post/edit attempt fails, so the admin panel
 * can surface why a save didn't take effect.
 * @param {{contentVersion:number, error:string}} fields
 * @returns {Promise<void>}
 */
export async function reportReactRoleSyncFailed({ contentVersion, error }) {
  const { data } = await api.post("/api/react-role/sync-failed", {
    app: "discord",
    guildId,
    contentVersion,
    error,
  });
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to report react-for-role sync failure");
  }
}

/**
 * POST /api/react-role/confirm-delete — call after confirming the live message is gone.
 * @returns {Promise<void>}
 */
export async function confirmReactRoleDelete() {
  const { data } = await api.post("/api/react-role/confirm-delete", {
    app: "discord",
    guildId,
  });
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to confirm react-for-role deletion");
  }
}
