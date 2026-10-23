import { apiFetch, apiFetchJson } from "./http.js";

/**
 * Paginated, searchable list of user mappings (bare canonical identity: id + name).
 * @param {{ limit?: number, offset?: number, search?: string }} [options]
 * @returns {Promise<{ items: Array<{id:number,name:string}>, total: number }>}
 */
export async function fetchUserMappings({ limit = 25, offset = 0, search = "" } = {}) {
  const params = new URLSearchParams({ app: "discord", limit: String(limit), offset: String(offset) });
  if (search) params.set("search", search);
  const data = await apiFetch(`/user-mappings?${params}`, undefined, "User mappings");
  return { items: data.userMappings, total: data.total };
}

/**
 * @param {{ name: string }} fields
 * @returns {Promise<object>}
 */
export async function createUserMapping(fields) {
  const data = await apiFetchJson(
    "POST",
    "/user-mappings?app=discord",
    fields,
    "Create user mapping",
  );
  return data.userMapping;
}

/**
 * @param {number} id
 * @param {{ name?: string }} fields
 * @returns {Promise<object>}
 */
export async function updateUserMapping(id, fields) {
  const data = await apiFetchJson(
    "PUT",
    `/user-mappings/${id}?app=discord`,
    fields,
    "Update user mapping",
  );
  return data.userMapping;
}

/**
 * Designate one of a mapping's already-linked aliases as its primary account.
 * @param {number} id
 * @param {number} guildMemberId
 * @returns {Promise<object>}
 */
export async function setPrimaryAlias(id, guildMemberId) {
  const data = await apiFetchJson(
    "POST",
    `/user-mappings/${id}/primary-alias`,
    { guildMemberId },
    "Set primary alias",
  );
  return data.userMapping;
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteUserMapping(id) {
  await apiFetch(`/user-mappings/${id}?app=discord`, { method: "DELETE" }, "Delete user mapping");
}
