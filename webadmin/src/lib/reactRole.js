import { apiFetch, apiFetchJson } from "./http.js";

/**
 * Fetch the one react-for-role message config for a server, or null if unconfigured.
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<object|null>}
 */
export async function fetchReactRoleMessage(app, guildId) {
  const params = new URLSearchParams({ app, guildId });
  const data = await apiFetch(`/react-role?${params}`, undefined, "React-for-role message");
  return data.message ?? null;
}

/**
 * Create or update the react-for-role message config for a server. The live Discord/Fluxer
 * message is posted/edited asynchronously by the bot, not by this request.
 * @param {string} app
 * @param {string} guildId
 * @param {{channelId:string, title:string, description?:string, bindings:Array<{emoji:string, roleId:string, description:string}>}} fields
 * @returns {Promise<object>}
 */
export async function saveReactRoleMessage(app, guildId, fields) {
  const data = await apiFetchJson(
    "PUT",
    "/react-role",
    { app, guildId, ...fields },
    "React-for-role save",
  );
  return data.message;
}

/**
 * Soft-delete the react-for-role message; the bot removes the live message and the row is then
 * hard-deleted.
 * @param {string} app
 * @param {string} guildId
 * @returns {Promise<void>}
 */
export async function deleteReactRoleMessage(app, guildId) {
  await apiFetchJson("DELETE", "/react-role", { app, guildId }, "React-for-role delete");
}
