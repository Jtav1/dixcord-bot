/**
 * Bump cache version after content mutations so bots reload cached data.
 */

import { incrementCacheVersion } from "../services/systemStatus.js";

/**
 * Increment cache version; logs errors but does not throw.
 * @returns {Promise<string|null>} New version or null on failure
 */
export async function bumpCacheVersion() {
  try {
    return await incrementCacheVersion();
  } catch (err) {
    console.error("bumpCacheVersion error:", err);
    return null;
  }
}
