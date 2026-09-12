import { apiFetch } from "./http.js";

/**
 * Fetch the catalog of dispatchable trigger-response functions.
 * @returns {Promise<Array<{ id: number, function_name: string, frequency: number, display_name: string|null }>>}
 */
export async function fetchTriggerResponseFunctions() {
  const data = await apiFetch(
    "/trigger-responses/functions",
    undefined,
    "Trigger response functions",
  );
  return data.responseFunctions;
}
