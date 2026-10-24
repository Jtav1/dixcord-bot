/**
 * System endpoints used by message handling: cache version polling.
 * (Heartbeat/metrics shipping is not ported yet — see FEATURE_PARITY.md background-behavior section.)
 */

import * as api from "./client.js";

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
