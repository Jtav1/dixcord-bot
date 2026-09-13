import { apiFetch } from "./http.js";

/**
 * Fetch every member across all guilds for an app, deduplicated by platformUserId
 * (most-recently-synced alias wins). Backs the cross-guild identity-lookup use case
 * (leaderboard voter chips, etc.) that no longer has a home on /user-mappings.
 * @param {{ app?: string }} [options]
 * @returns {Promise<Array<{id:number|null,name:string|null,handle:string|null,platformUserId:string}>>}
 */
export async function fetchAllGuildMembers({ app = "discord" } = {}) {
  const data = await apiFetch(`/guild-members?app=${encodeURIComponent(app)}`, undefined, "Guild members");
  return data.members ?? [];
}
