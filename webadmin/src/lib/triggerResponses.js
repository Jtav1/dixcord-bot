import { apiFetch, apiFetchJson } from "./http.js";

/**
 * List all triggers with id and selection_mode (CRUD listing).
 * @returns {Promise<Array<{ id: number, trigger_string: string, selection_mode: string }>>}
 */
export async function fetchTriggersList() {
  const data = await apiFetch("/trigger-responses/triggers/list", undefined, "Triggers");
  return data.triggers;
}

/**
 * Get one trigger with its responses.
 * @param {number} id
 * @returns {Promise<{ id: number, trigger_string: string, selection_mode: string, created_at: string, responses: Array<{ id: number, response_string: string, order: number|null, weight: number|null, response_function: string|null, response_function_parameters: object|null, linkId: number }> }>}
 */
export async function fetchTriggerDetail(id) {
  return apiFetch(`/trigger-responses/triggers/${id}`, undefined, "Trigger detail");
}

/**
 * Create a trigger with its initial batch of responses.
 * @param {{ trigger_string: string, selection_mode?: string, responses: Array<{ response_string: string, order?: number, weight?: number, response_function?: string|null }> }} payload
 * @returns {Promise<object>} The created trigger, per fetchTriggerDetail's shape.
 */
export async function createTrigger(payload) {
  return apiFetchJson("POST", "/trigger-responses/triggers", payload, "Create trigger");
}

/**
 * Update a trigger's selection_mode.
 * @param {number} id
 * @param {string} selectionMode
 * @returns {Promise<object>}
 */
export async function updateTriggerSelectionMode(id, selectionMode) {
  return apiFetchJson(
    "PUT",
    `/trigger-responses/triggers/${id}`,
    { selection_mode: selectionMode },
    "Update trigger",
  );
}

/**
 * Add a new response to an existing trigger.
 * @param {number} id
 * @param {{ response_string: string, order?: number|null, weight?: number|null, response_function?: string|null }} response
 * @returns {Promise<object>}
 */
export async function addTriggerResponse(id, response) {
  return apiFetchJson(
    "PUT",
    `/trigger-responses/triggers/${id}`,
    { responses: [response] },
    "Add response",
  );
}

/**
 * Update an existing trigger-response link's order/weight/response_function.
 * @param {number} triggerId
 * @param {number} linkId trigger_response junction row id.
 * @param {{ order?: number|null, weight?: number|null, response_function?: string|null }} fields
 * @returns {Promise<object>}
 */
export async function updateTriggerResponseLinkFields(triggerId, linkId, fields) {
  return apiFetchJson(
    "PUT",
    `/trigger-responses/triggers/${triggerId}`,
    { responses: [{ id: linkId, ...fields }] },
    "Update response link",
  );
}

/**
 * Delete a trigger (and orphaned responses no longer linked to any trigger).
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteTrigger(id) {
  await apiFetch(`/trigger-responses/triggers/${id}`, { method: "DELETE" }, "Delete trigger");
}

/**
 * Update a response's shared text (applies everywhere this response is linked).
 * @param {number} responseId
 * @param {string} responseString
 * @returns {Promise<void>}
 */
export async function updateResponseText(responseId, responseString) {
  await apiFetchJson(
    "PUT",
    `/trigger-responses/responses/${responseId}`,
    { response_string: responseString },
    "Update response",
  );
}

/**
 * Delete a response entirely (unlinks it from every trigger that used it).
 * @param {number} responseId
 * @returns {Promise<void>}
 */
export async function deleteResponse(responseId) {
  await apiFetch(
    `/trigger-responses/responses/${responseId}`,
    { method: "DELETE" },
    "Delete response",
  );
}

/**
 * Remove a single trigger-response link without deleting the shared response row.
 * @param {number} linkId trigger_response junction row id.
 * @returns {Promise<void>}
 */
export async function removeTriggerResponseLink(linkId) {
  await apiFetch(`/trigger-responses/${linkId}`, { method: "DELETE" }, "Remove response link");
}

/**
 * Set (or clear) a link's response_function JSON parameters payload.
 * @param {number} linkId
 * @param {object|null} parameters
 * @returns {Promise<void>}
 */
export async function updateLinkParameters(linkId, parameters) {
  await apiFetchJson(
    "PATCH",
    `/trigger-responses/${linkId}/parameters`,
    { parameters },
    "Update parameters",
  );
}

/**
 * List the dispatchable trigger-response function catalog.
 * @returns {Promise<Array<{ id: number, function_name: string, frequency: number, display_name: string|null }>>}
 */
export async function fetchTriggerFunctions() {
  const data = await apiFetch("/trigger-responses/functions", undefined, "Trigger functions");
  return data.responseFunctions;
}
