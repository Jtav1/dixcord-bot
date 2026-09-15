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

/**
 * Parameter shapes for pre-filling the Parameters editor. Keep in sync with
 * discord-bot/utilities/triggerResponseFunctions.js — no shared package between the two.
 * @type {Record<string, Record<string, string>>}
 */
export const FUNCTION_PARAMETER_SHAPES = {
  TAL_timeout: { rollMax: "", timeoutSeconds: "" },
  placeholder_message: {},
};

/**
 * Blank-valued default parameters object for a function, for pre-filling the Parameters editor.
 * @param {string|null|undefined} functionName
 * @returns {Record<string, string>|null} null if the function takes no parameters, or its shape isn't known.
 */
export function defaultParametersFor(functionName) {
  const shape = functionName ? FUNCTION_PARAMETER_SHAPES[functionName] : null;
  if (!shape || Object.keys(shape).length === 0) return null;
  return { ...shape };
}
