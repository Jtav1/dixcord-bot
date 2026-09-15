import { apiFetch, apiFetchJson } from "./http.js";

/**
 * Fetch system and bot health status from webapi.
 * @returns {Promise<{
 *   webapi: string,
 *   db: string,
 *   dbType: string,
 *   cacheVersion: string,
 *   webapiUptimeSeconds: number,
 *   webapiMemoryRssBytes: number,
 *   bot: {
 *     guildId: string,
 *     version: string,
 *     lastSeenAt: string,
 *     online: boolean,
 *     readyAt: string | null,
 *     uptimeSeconds: number | null,
 *     memberCount: number | null,
 *     channelCount: number | null,
 *     wsPingMs: number | null,
 *   } | null,
 * }>}
 */
export async function fetchSystemStatus() {
  const data = await apiFetch("/system/status", undefined, "System status");
  return data.status;
}

/**
 * Bump webapi's config cache version, forcing bot clients to refresh cached config.
 * @returns {Promise<void>}
 */
export async function invalidateConfigCache() {
  await apiFetchJson("POST", "/system/invalidate-cache", {}, "Cache invalidation");
}
