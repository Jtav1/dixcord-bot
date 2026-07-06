import { API_BASE } from "./api.js";

/** Default number of top/bottom plusplus entries shown in the web view. */
export const LEADERBOARD_LIMIT = 20;

/** Vote history rows shown per page inside an expanded leaderboard entry. */
export const VOTE_HISTORY_PAGE_SIZE = 50;

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
 * @returns {Promise<{ top: Array<{ string: string, typestr: string, total: number }>, bottom: Array<{ string: string, typestr: string, total: number }> }>} `bottom` is sorted lowest total first.
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

  const bottom = Array.isArray(data.bottom) ? data.bottom : [];
  bottom.sort((a, b) => a.total - b.total);

  return {
    top: Array.isArray(data.top) ? data.top : [],
    bottom,
  };
}

/**
 * Fetch full plus/minus vote history for one leaderboard row.
 * @param {string} rowId Platform user id or word text (leaderboard `string` field).
 * @param {string} typestr Leaderboard `typestr` (`user` or `word`).
 * @param {string} [app="discord"] Chat app id.
 * @returns {Promise<{ string: string, type: string, total: number, count: number, votes: Array<{ id: number, value: number, voterPlatformId: string|null, timestamp: string }> }>}
 */
export async function fetchPlusPlusVoteHistory(
  rowId,
  typestr,
  app = "discord",
) {
  const type = typestr === "user" ? "user" : "word";
  const params = new URLSearchParams({ app, type });
  const res = await fetch(
    `${API_BASE}/leaderboards/plusplus/history/${encodeURIComponent(rowId)}?${params}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to load plusplus vote history (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Plusplus vote history");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load plusplus vote history");
  }

  return {
    string: String(data.string ?? rowId),
    type: String(data.type ?? type),
    total: Number(data.total ?? 0),
    count: Number(data.count ?? 0),
    votes: Array.isArray(data.votes) ? data.votes : [],
  };
}

/**
 * Fetch user mappings whose platform user ids appear in `platformUserIds`.
 * Paginates through GET /api/user-mappings until every id is found or the list is exhausted.
 * @param {Array<string|null|undefined>} platformUserIds Discord snowflakes to resolve.
 * @param {string} [app="discord"] Chat app id.
 * @returns {Promise<Array<{ name: string, platformUserId: string }>>}
 */
export async function fetchUserMappingsForPlatformIds(
  platformUserIds,
  app = "discord",
) {
  const needed = new Set(
    platformUserIds.filter((id) => id != null && id !== "").map(String),
  );
  if (needed.size === 0) return [];

  const found = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total && needed.size > 0) {
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
    for (const row of rows) {
      const id = String(row.platformUserId);
      if (needed.has(id)) {
        found.push(row);
        needed.delete(id);
      }
    }

    total = Number(data.total ?? found.length);
    offset += rows.length;

    if (rows.length === 0) break;
  }

  return found;
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
 * Stable key for a leaderboard row (used for expansion panel state and history cache).
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @returns {string}
 */
export function leaderboardEntryKey(entry) {
  return `${entry.typestr}:${entry.string}`;
}

/**
 * Resolve the display label for a voter platform user id.
 * @param {string|null|undefined} voterPlatformId Discord snowflake.
 * @param {Map<string, string>} nameMap platformUserId → display name.
 * @returns {string}
 */
export function resolveVoterLabel(voterPlatformId, nameMap) {
  if (voterPlatformId == null || voterPlatformId === "") return "Unknown";
  return nameMap.get(String(voterPlatformId)) ?? String(voterPlatformId);
}

/**
 * Resolve the display label for a plusplus leaderboard entry.
 * User entries use mapped name when available, prefixed with `@`; word entries use the raw string.
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @param {Map<string, string>} nameMap platformUserId → display name.
 * @returns {string}
 */
export function resolveEntryLabel(entry, nameMap) {
  if (entry?.typestr === "user") {
    const name = nameMap.get(String(entry.string)) ?? String(entry.string);
    return "@" + " " + name;
  }
  return String(entry?.string ?? "");
}
