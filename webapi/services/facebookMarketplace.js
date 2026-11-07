/**
 * Facebook Marketplace link scraping/caching. Facebook renders listing data (title/price/
 * location/description/photo) into the page's own server-rendered Relay JSON blob — not
 * something requiring JS execution — but only when the request carries a full, realistic
 * browser header set; a bare fetch() gets a 400. This is scraping an undocumented, unstable
 * internal shape Facebook can change without notice, so every extraction failure degrades to
 * "not a listing" rather than throwing — a scrape failure must never surface as a chat error.
 */

import db from "../config/db.js";
import { getGuildConfigValue } from "./guildConfig.js";

const isSqlite = (process.env.DB_TYPE || "mysql").toLowerCase() === "sqlite";

const FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"]);

/** Headers verified to get a 200 from facebook.com instead of a 400 (see plan research). */
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

const FETCH_TIMEOUT_MS = 10_000;
const DESCRIPTION_MAX_LENGTH = 800;
const MARKETPLACE_ITEM_RE = /\/marketplace\/item\/(\d+)/;

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isFacebookUrl(url) {
  try {
    return FACEBOOK_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * @returns {number}
 */
function getCacheTtlDays() {
  const parsed = parseInt(process.env.FACEBOOK_MARKETPLACE_CACHE_TTL_DAYS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

/**
 * @param {Record<string, unknown>} row
 * @returns {object}
 */
function cacheRowToListing(row) {
  return {
    id: row.listing_id,
    url: row.canonical_url,
    title: row.title,
    price: row.price,
    location: row.location,
    description: row.description,
    imageUrl: row.image_url,
  };
}

/**
 * @param {string} listingId
 * @returns {Promise<object|null>} cached listing, or null if missing/stale
 */
async function getCachedListing(listingId) {
  const ttlDays = getCacheTtlDays();
  const [rows] = await db.query(
    isSqlite
      ? "SELECT * FROM facebook_marketplace_cache WHERE listing_id = ? AND scraped_at >= datetime('now', ?)"
      : "SELECT * FROM facebook_marketplace_cache WHERE listing_id = ? AND scraped_at >= DATE_SUB(NOW(), INTERVAL ? DAY)",
    isSqlite ? [listingId, `-${ttlDays} days`] : [listingId, ttlDays],
  );
  if (!rows || rows.length === 0) return null;
  return cacheRowToListing(rows[0]);
}

/**
 * Upsert a scraped (or scrape-attempted) listing, then opportunistically delete rows past the
 * TTL — piggybacking on write traffic instead of a dedicated cron job.
 * @param {{ id: string, url: string, title: string|null, price: string|null, location: string|null, description: string|null, imageUrl: string|null }} listing
 * @returns {Promise<void>}
 */
async function cacheListing(listing) {
  const params = [listing.id, listing.url, listing.title, listing.price, listing.location, listing.description, listing.imageUrl];
  if (isSqlite) {
    await db.query(
      `INSERT INTO facebook_marketplace_cache (listing_id, canonical_url, title, price, location, description, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(listing_id) DO UPDATE SET
         canonical_url = excluded.canonical_url, title = excluded.title, price = excluded.price,
         location = excluded.location, description = excluded.description, image_url = excluded.image_url,
         scraped_at = CURRENT_TIMESTAMP`,
      params,
    );
  } else {
    await db.query(
      `INSERT INTO facebook_marketplace_cache (listing_id, canonical_url, title, price, location, description, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         canonical_url = VALUES(canonical_url), title = VALUES(title), price = VALUES(price),
         location = VALUES(location), description = VALUES(description), image_url = VALUES(image_url),
         scraped_at = CURRENT_TIMESTAMP`,
      params,
    );
  }

  const ttlDays = getCacheTtlDays();
  await db.query(
    isSqlite
      ? "DELETE FROM facebook_marketplace_cache WHERE scraped_at < datetime('now', ?)"
      : "DELETE FROM facebook_marketplace_cache WHERE scraped_at < DATE_SUB(NOW(), INTERVAL ? DAY)",
    isSqlite ? [`-${ttlDays} days`] : [ttlDays],
  );
}

/**
 * JSON-unescape a raw capture from Facebook's embedded JSON (standard JSON string escaping —
 * \n, \", ·, \/, etc.) by wrapping it in quotes and letting JSON.parse do the work.
 * @param {string} raw
 * @returns {string}
 */
function unescapeJsonString(raw) {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw;
  }
}

/**
 * @param {string} html
 * @returns {string|null}
 */
function extractOgImage(html) {
  const match = html.match(/<meta property="og:image" content="([^"]*)"/);
  if (!match) return null;
  return match[1].replace(/&amp;/g, "&");
}

/**
 * Extract title/price/location/description from Facebook's embedded Relay JSON, anchored on
 * `redacted_description` (confirmed unique per page) and a window around it — unlike
 * `marketplace_listing_title`/`formatted_price`, which also appear in sidebar "related
 * listings" cards and can't be matched as a bare first-occurrence.
 * @param {string} html
 * @param {string} listingId
 * @returns {{ title: string|null, price: string|null, location: string|null, description: string|null }}
 */
function extractListingFields(html, listingId) {
  const descMatch = html.match(/"redacted_description":\{"text":"((?:[^"\\]|\\.)*)"\}/);
  if (!descMatch) {
    return { title: null, price: null, location: null, description: null };
  }

  const windowStart = Math.max(0, descMatch.index - 2000);
  const windowEnd = Math.min(html.length, descMatch.index + descMatch[0].length + 2000);
  const window = html.slice(windowStart, windowEnd);

  // Sanity-check this window actually belongs to the requested listing, not an unrelated block.
  if (!window.includes(`"id":"${listingId}"`)) {
    return { title: null, price: null, location: null, description: null };
  }

  const titleMatch = window.match(/"marketplace_listing_title":"((?:[^"\\]|\\.)*)"/);
  const priceMatch = window.match(/"formatted_price":\{"text":"((?:[^"\\]|\\.)*)"\}/);
  const locationMatch = window.match(/"location_text":\{"text":"((?:[^"\\]|\\.)*)"\}/);

  let description = unescapeJsonString(descMatch[1]);
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    description = `${description.slice(0, DESCRIPTION_MAX_LENGTH)}...`;
  }

  return {
    title: titleMatch ? unescapeJsonString(titleMatch[1]) : null,
    price: priceMatch ? unescapeJsonString(priceMatch[1]) : null,
    location: locationMatch ? unescapeJsonString(locationMatch[1]) : null,
    description,
  };
}

/**
 * Fetch a URL with the browser header set, following redirects (handles the facebook.com/share/
 * short-link form, which 302s to the long-form marketplace URL).
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function fetchFacebookPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve a Facebook URL and, if it's a Marketplace listing, return its scraped (or cached)
 * details. Re-checks the guild toggle itself (defense in depth, not just a bot-side skip).
 * Never throws — any fetch/parse failure degrades to `{ isMarketplaceListing: false }`.
 * @param {string} url
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<{ isMarketplaceListing: boolean, listing?: object }>}
 */
export async function getFacebookMarketplacePreview(url, app, guildId) {
  const enabled = (await getGuildConfigValue(app, guildId, "facebook_marketplace_enabled")) === "true";
  if (!enabled) return { isMarketplaceListing: false };

  try {
    const directMatch = url.match(MARKETPLACE_ITEM_RE);
    if (directMatch) {
      const cached = await getCachedListing(directMatch[1]);
      if (cached) return { isMarketplaceListing: true, listing: cached };
    }

    const response = await fetchFacebookPage(url);
    const finalMatch = response.url.match(MARKETPLACE_ITEM_RE);
    if (!finalMatch) return { isMarketplaceListing: false };

    const listingId = finalMatch[1];
    const cached = await getCachedListing(listingId);
    if (cached) return { isMarketplaceListing: true, listing: cached };

    const html = await response.text();
    const fields = extractListingFields(html, listingId);
    const listing = {
      id: listingId,
      url: `https://www.facebook.com/marketplace/item/${listingId}/`,
      imageUrl: extractOgImage(html),
      ...fields,
    };
    await cacheListing(listing);
    return { isMarketplaceListing: true, listing };
  } catch (err) {
    console.error("webapi: Facebook Marketplace scrape failed:", err.message);
    return { isMarketplaceListing: false };
  }
}
