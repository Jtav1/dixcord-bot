import { API_BASE } from "./api.js";

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
 * Fetch one identity's per-guild handle/nickname (public-safe — no ids, no platform user id).
 * @param {number} chatMemberMappingId
 * @returns {Promise<Array<{ app: string, guildId: string, guildName: string|null, handle: string|null, nickname: string|null }>>}
 */
export async function fetchAliasesForMapping(chatMemberMappingId) {
  const res = await fetch(
    `${API_BASE}/guild-members/public-aliases/${encodeURIComponent(chatMemberMappingId)}`,
  );

  if (!res.ok) {
    throw new Error(`Failed to load linked servers (${res.status})`);
  }

  const data = await parseJsonResponse(res, "Linked servers");
  if (!data?.ok) {
    throw new Error(data?.error || "Failed to load linked servers");
  }

  return Array.isArray(data.members) ? data.members : [];
}

/**
 * Build a lookup from platform user id to that user's identity chip data, for contexts that only
 * know a Discord snowflake (leaderboards, vote history).
 * @param {Array<{ platformUserId?: string, id?: number|null, name?: string|null, nickname?: string|null, handle?: string|null }>} members guild_members rows (e.g. from plusplusRankings.js's fetchAllGuildMembers).
 * @returns {Map<string, { mappingId: number|null, name: string|null, nickname: string|null, handle: string|null }>}
 */
export function buildIdentityMapByPlatformId(members) {
  const map = new Map();
  for (const row of members) {
    if (row?.platformUserId == null) continue;
    map.set(String(row.platformUserId), {
      mappingId: row.id != null ? Number(row.id) : null,
      name: row.name ?? null,
      nickname: row.nickname ?? null,
      handle: row.handle ?? null,
    });
  }
  return map;
}

/**
 * Build a lookup from chat_member_mapping id to identity chip data, for contexts that only know
 * the internal mapping id (e.g. pin_history.author/pinners).
 * @param {Array<{ id?: number|null, name?: string|null, nickname?: string|null, handle?: string|null }>} members guild_members rows.
 * @returns {Map<number, { name: string|null, nickname: string|null, handle: string|null }>}
 */
export function buildIdentityMapByMappingId(members) {
  const map = new Map();
  for (const row of members) {
    if (row?.id == null) continue;
    map.set(Number(row.id), {
      name: row.name ?? null,
      nickname: row.nickname ?? null,
      handle: row.handle ?? null,
    });
  }
  return map;
}
