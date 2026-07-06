/**
 * Poll webapi cache version and refresh in-memory caches when it changes.
 */

import { getCacheVersion } from "./system.js";
import { loadConfig } from "../configStore.js";
import { getTriggersList } from "./triggerResponses.js";
import { getLinkReplacementSourceHosts } from "./linkReplacements.js";

/** @type {Array<{ trigger_string: string, selection_mode?: string }>|null} */
let cachedTriggers = null;

/** @type {string[]|null} */
let cachedLinkHosts = null;

/** @type {string|null} */
let lastCacheVersion = null;

const POLL_INTERVAL_MS = 30_000;

/**
 * Reload trigger and link-replacement caches from webapi.
 * @returns {Promise<void>}
 */
export async function refreshContentCaches() {
  cachedTriggers = await getTriggersList();
  cachedLinkHosts = await getLinkReplacementSourceHosts();
}

/**
 * @returns {Array<{ trigger_string: string, selection_mode?: string }>|null}
 */
export function getCachedTriggers() {
  return cachedTriggers;
}

/**
 * @returns {string[]|null}
 */
export function getCachedLinkHosts() {
  return cachedLinkHosts;
}

/**
 * Reload config and content caches (config version bump or startup).
 * @returns {Promise<void>}
 */
export async function reloadAllCaches() {
  await loadConfig();
  await refreshContentCaches();
}

/**
 * Start polling cache version and reload when it changes.
 * @returns {void}
 */
export function startCacheVersionPoller() {
  setInterval(async () => {
    try {
      const version = await getCacheVersion();
      if (lastCacheVersion != null && version !== lastCacheVersion) {
        console.log(
          `cache: Cache version changed (${lastCacheVersion} -> ${version}); reloading`,
        );
        await reloadAllCaches();
      }
      lastCacheVersion = version;
    } catch (err) {
      console.error("cache: version poll error:", err);
    }
  }, POLL_INTERVAL_MS);
}

await refreshContentCaches();
