import { apiFetch, apiFetchJson } from "./http.js";

/**
 * All members across all guilds for an app, deduplicated by platformUserId (most-recent alias wins).
 * @param {{ app?: string }} [options]
 * @returns {Promise<Array<{id:number|null,name:string|null,handle:string|null,platformUserId:string}>>}
 */
export async function fetchAllGuildMembers({ app = "discord" } = {}) {
  const data = await apiFetch(`/guild-members?app=${encodeURIComponent(app)}`, undefined, "Guild members");
  return data.members ?? [];
}

/**
 * guild_members rows with no member_aliases link yet — candidates for linking as an alias.
 * @param {{ app?: string, guildId?: string, search?: string }} [options]
 * @returns {Promise<Array<{id:number,app:string,guildId:string,platformUserId:string,handle:string|null,nickname:string|null,roles:Array<{id:string,name:string|null}>,joinedAt:string|null,syncedAt:string}>>} `roles` entries are resolved guild_roles rows, not bare ids.
 */
export async function fetchUnlinkedGuildMembers({ app = "discord", guildId, search } = {}) {
  const params = new URLSearchParams({ app });
  if (guildId) params.set("guildId", guildId);
  if (search) params.set("search", search);
  const data = await apiFetch(`/guild-members/unlinked?${params}`, undefined, "Unlinked guild members");
  return data.members ?? [];
}

/**
 * Every guild_members row, including already-linked ones (with their mapping id/name) — for the admin manual-link picker.
 * @param {{ app?: string, guildId?: string, search?: string }} [options]
 * @returns {Promise<Array<{id:number,app:string,guildId:string,platformUserId:string,handle:string|null,nickname:string|null,roles:Array<{id:string,name:string|null}>,joinedAt:string|null,syncedAt:string,linkedMappingId:number|null,linkedMappingName:string|null}>>}
 */
export async function fetchAllGuildMemberRows({ app = "discord", guildId, search } = {}) {
  const params = new URLSearchParams({ app });
  if (guildId) params.set("guildId", guildId);
  if (search) params.set("search", search);
  const data = await apiFetch(`/guild-members/all?${params}`, undefined, "All guild members");
  return data.members ?? [];
}

/**
 * guild_members rows currently linked (member_aliases) to this chat_member_mapping identity.
 * @param {number} chatMemberMappingId
 * @returns {Promise<Array<{id:number,app:string,guildId:string,guildName:string|null,platformUserId:string,handle:string|null,nickname:string|null,roles:Array<{id:string,name:string|null}>,joinedAt:string|null,syncedAt:string}>>} `roles` entries are resolved guild_roles rows, not bare ids.
 */
export async function fetchAliasesForMapping(chatMemberMappingId) {
  const data = await apiFetch(
    `/guild-members/aliases/${chatMemberMappingId}`,
    undefined,
    "Mapping aliases",
  );
  return data.members ?? [];
}

/**
 * Link (or move) a guild_member to a chat_member_mapping identity as one of its aliases.
 * @param {number} guildMemberId
 * @param {number} chatMemberMappingId
 * @returns {Promise<void>}
 */
export async function linkGuildMemberAlias(guildMemberId, chatMemberMappingId) {
  await apiFetchJson(
    "POST",
    `/guild-members/${guildMemberId}/link`,
    { chatMemberMappingId },
    "Link guild member",
  );
}

/**
 * Unlink a guild_member from whichever identity it's aliased to.
 * @param {number} guildMemberId
 * @returns {Promise<void>}
 */
export async function unlinkGuildMemberAlias(guildMemberId) {
  await apiFetch(`/guild-members/${guildMemberId}/link`, { method: "DELETE" }, "Unlink guild member");
}
