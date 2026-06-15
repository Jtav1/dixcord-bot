/**
 * System endpoints: heartbeat and cache version polling.
 */

import * as api from "./client.js";
import { guildId, version } from "../configVars.js";

const HEARTBEAT_INTERVAL_MS = 60000;

/**
 * POST bot heartbeat to webapi.
 * @returns {Promise<void>}
 */
export async function sendHeartbeat() {
  await api.post("/api/system/heartbeat", {
    guildId,
    version,
    lastReadyAt: new Date().toISOString(),
  });
}

/**
 * GET current cache version from webapi.
 * @returns {Promise<string>}
 */
export async function getCacheVersion() {
  const { data } = await api.get("/api/system/cache-version");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to get cache version");
  }
  return String(data.cacheVersion);
}

/**
 * Start periodic heartbeat posts.
 * @returns {void}
 */
export function startHeartbeat() {
  const tick = async () => {
    try {
      await sendHeartbeat();
    } catch (err) {
      console.error("Heartbeat error:", err);
    }
  };
  tick();
  setInterval(tick, HEARTBEAT_INTERVAL_MS);
}
