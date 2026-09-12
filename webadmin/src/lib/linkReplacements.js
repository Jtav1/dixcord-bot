import { apiFetch, apiFetchJson } from "./http.js";

/**
 * List all link replacements.
 * @returns {Promise<Array<{ id: number, source_host: string, target_host: string }>>}
 */
export async function fetchLinkReplacements() {
  const data = await apiFetch("/link-replacements", undefined, "Link replacements");
  return data.linkReplacements;
}

/**
 * @param {string} sourceHost
 * @param {string} targetHost
 * @returns {Promise<{ id: number, source_host: string, target_host: string }>}
 */
export async function createLinkReplacement(sourceHost, targetHost) {
  return apiFetchJson(
    "POST",
    "/link-replacements",
    { source_host: sourceHost, target_host: targetHost },
    "Create link replacement",
  );
}

/**
 * @param {number} id
 * @param {{ source_host?: string, target_host?: string }} fields
 * @returns {Promise<{ id: number, source_host: string, target_host: string }>}
 */
export async function updateLinkReplacement(id, fields) {
  return apiFetchJson("PUT", `/link-replacements/${id}`, fields, "Update link replacement");
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteLinkReplacement(id) {
  await apiFetch(`/link-replacements/${id}`, { method: "DELETE" }, "Delete link replacement");
}
