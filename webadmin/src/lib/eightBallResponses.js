import { apiFetch, apiFetchJson } from "./http.js";

/**
 * List all eight-ball responses.
 * @returns {Promise<Array<{ id: number, response_string: string, sentiment: string, frequency: number }>>}
 */
export async function fetchEightBallResponses() {
  const data = await apiFetch("/eight-ball-responses", undefined, "Eight-ball responses");
  return data.eightBallResponses;
}

/**
 * @param {string} responseString
 * @param {"positive"|"negative"|"neutral"} sentiment
 * @returns {Promise<{ id: number, response_string: string, sentiment: string, frequency: number }>}
 */
export async function createEightBallResponse(responseString, sentiment) {
  const data = await apiFetchJson(
    "POST",
    "/eight-ball-responses",
    { response_string: responseString, sentiment },
    "Create eight-ball response",
  );
  return data.eightBallResponse;
}

/**
 * @param {number} id
 * @param {{ response_string?: string, sentiment?: string }} fields
 * @returns {Promise<{ id: number, response_string: string, sentiment: string, frequency: number }>}
 */
export async function updateEightBallResponse(id, fields) {
  const data = await apiFetchJson(
    "PUT",
    `/eight-ball-responses/${id}`,
    fields,
    "Update eight-ball response",
  );
  return data.eightBallResponse;
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteEightBallResponse(id) {
  await apiFetch(`/eight-ball-responses/${id}`, { method: "DELETE" }, "Delete eight-ball response");
}
