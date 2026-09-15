/**
 * System endpoints: heartbeat and cache version polling.
 */

import * as api from "./client.js";
import { guildId, version } from "../configVars.js";
import {
  getMetricsSnapshot,
  incrementCounter,
} from "../utilities/metrics.js";

const HEARTBEAT_INTERVAL_MS = 60000;

/** @type {import("discord.js").Client|null} */
let heartbeatClient = null;
/** @type {Date|null} When the current gateway session became ready; stable until restart. */
let heartbeatReadyAt = null;

/**
 * POST bot heartbeat to webapi, including live guild/gateway health fields (all free to read
 * from discord.js's cache - no extra Discord API calls).
 * @returns {Promise<void>}
 */
export async function sendHeartbeat() {
  const guild = heartbeatClient?.guilds.cache.get(guildId) ?? null;
  await api.post("/api/system/heartbeat", {
    app: "discord",
    guildId,
    version,
    readyAt: heartbeatReadyAt?.toISOString() ?? null,
    memberCount: guild?.memberCount ?? null,
    channelCount: guild?.channels.cache.size ?? null,
    wsPingMs: heartbeatClient?.ws.ping ?? null,
    metrics: getMetricsSnapshot(),
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
 * @param {import("discord.js").Client} client - Ready Discord client (for guild/gateway fields).
 * @param {Date} readyAt - When the client's current gateway session became ready.
 * @returns {void}
 */
export function startHeartbeat(client, readyAt) {
  heartbeatClient = client;
  heartbeatReadyAt = readyAt;
  const tick = async () => {
    try {
      await sendHeartbeat();
    } catch (err) {
      incrementCounter("heartbeatSendErrorsTotal");
      console.error("Heartbeat error:", err);
    }
  };
  tick();
  setInterval(tick, HEARTBEAT_INTERVAL_MS);
}
