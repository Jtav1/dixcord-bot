/**
 * System endpoints: cache version polling and heartbeat.
 */

import * as api from "./client.js";
import { guildId, version } from "../configVars.js";
import { client } from "../fluxerClient.js";
import { getMetricsSnapshot, incrementCounter } from "../utilities/metrics.js";

const HEARTBEAT_INTERVAL_MS = 60000;

/** @type {Date|null} When the current gateway session became ready; stable until restart. */
let heartbeatReadyAt = null;

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
 * POST bot heartbeat to webapi, including live guild/gateway health fields (all free to read
 * from fluxer.js's cache - no extra API calls).
 * @returns {Promise<void>}
 */
export async function sendHeartbeat() {
  const guild = client.guilds.get(guildId) ?? null;
  await api.post("/api/system/heartbeat", {
    app: "fluxer",
    guildId,
    version,
    readyAt: heartbeatReadyAt?.toISOString() ?? null,
    memberCount: guild?.memberCount ?? null,
    channelCount: guild?.channels.size ?? null,
    wsPingMs: client.ws.ping,
    metrics: getMetricsSnapshot(),
  });
}

/**
 * Start periodic heartbeat posts.
 * @param {Date} readyAt - When the client's current gateway session became ready.
 * @returns {void}
 */
export function startHeartbeat(readyAt) {
  heartbeatReadyAt = readyAt;
  const tick = async () => {
    try {
      await sendHeartbeat();
    } catch (err) {
      incrementCounter("heartbeatSendErrorsTotal");
      console.error("bot: heartbeat error:", err);
    }
  };
  tick();
  setInterval(tick, HEARTBEAT_INTERVAL_MS);
}
