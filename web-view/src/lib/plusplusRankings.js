import { API_BASE } from "./api.js";

/** Default number of top/bottom plusplus entries shown in the web view. */
export const LEADERBOARD_LIMIT = 20;

/** Max page size supported by GET /api/user-mappings. */
const USER_MAPPINGS_PAGE_SIZE = 200;

/**
 * Parse a fetch Response as JSON, with a clear error when the body is not JSON.
 * @param {Response} res Fetch response.
 * @param {string} context Label for error messages.
 * @returns {Promise<unknown>}
 */
async function parseJsonResponse(res, context) {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!contentType.includes("application/json")) {
    throw new Error(
      `${context}: expected JSON but got ${contentType || "unknown content type"}`,
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${context}: invalid JSON response`);
  }
}

/**
 * Fetch plusplus top and bottom leaderboard slices from webapi.
 * @param {number} [limit=LEADERBOARD_LIMIT] Max entries per top/bottom list.
 * @returns {Promise<{ top: Array<{ string: string, typestr: string, total: number }>, bottom: Array<{ string: string, typestr: string, total: number }> }>}
 */
export async function fetchPlusPlusLeaderboard(limit = LEADERBOARD_LIMIT) {
  const res = await fetch(`${API_BASE}/leaderboards/plusplus`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app: "discord", limit }),
  });

  if (!res.ok) {
    throw new Error(`Failed to load plusplus leaderboard (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Plusplus leaderboard");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load plusplus leaderboard");
  }

  return {
    top: Array.isArray(data.top) ? data.top : [],
    bottom: Array.isArray(data.bottom) ? data.bottom : [],
  };
}

/**
 * Fetch all user mappings for an app, paginating until every row is loaded.
 * @param {string} [app="discord"] Chat app id.
 * @returns {Promise<Array<{ name: string, platformUserId: string }>>}
 */
export async function fetchAllUserMappings(app = "discord") {
  const all = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const params = new URLSearchParams({
      app,
      limit: String(USER_MAPPINGS_PAGE_SIZE),
      offset: String(offset),
    });
    const res = await fetch(`${API_BASE}/user-mappings?${params}`);

    if (!res.ok) {
      throw new Error(`Failed to load user mappings (${res.status})`);
    }

    const data = await parseJsonResponse(res, "User mappings");
    if (!data?.ok) {
      throw new Error(data?.error || "Failed to load user mappings");
    }

    const rows = Array.isArray(data.userMappings) ? data.userMappings : [];
    all.push(...rows);
    total = Number(data.total ?? all.length);
    offset += rows.length;

    if (rows.length === 0) break;
  }

  return all;
}

/**
 * Build a lookup map from platform user id to display name.
 * @param {Array<{ name: string, platformUserId: string }>} userMappings
 * @returns {Map<string, string>}
 */
export function buildUserNameMap(userMappings) {
  const map = new Map();
  for (const row of userMappings) {
    if (row?.platformUserId != null && row?.name != null) {
      map.set(String(row.platformUserId), String(row.name));
    }
  }
  return map;
}

/**
 * Resolve the display label for a plusplus leaderboard entry.
 * User entries use mapped name when available; word entries use the raw string.
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @param {Map<string, string>} nameMap platformUserId → display name.
 * @returns {string}
 */
export function resolveEntryLabel(entry, nameMap) {
  if (entry?.typestr === "user") {
    return nameMap.get(String(entry.string)) ?? String(entry.string);
  }
  return String(entry?.string ?? "");
}
