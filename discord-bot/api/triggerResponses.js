import * as api from "./client.js";

/**
 * List unique trigger strings (for matching against stripped message content).
 * GET /api/trigger-responses/triggers
 * @returns {Promise<string[]>}
 */
export const getTriggerList = async () => {
  const { data } = await api.get("/api/trigger-responses/triggers");
  if (!data?.ok || !Array.isArray(data.triggers)) return [];
  return data.triggers;
};

/**
 * List all triggers with id and selection_mode (for weighted/random/ordered handling).
 * GET /api/trigger-responses/triggers/list
 * @returns {Promise<Array<{ id: number, trigger_string: string, selection_mode: string }>>}
 */
export const getTriggersList = async () => {
  const { data } = await api.get("/api/trigger-responses/triggers/list");
  if (!data?.ok || !Array.isArray(data.triggers)) return [];
  return data.triggers;
};

/**
 * Get all responses for a trigger (by trigger string).
 * GET /api/trigger-responses/triggers/responses?trigger=xxx
 * @param {string} triggerString - Trigger string
 * @returns {Promise<{ trigger_id: number, trigger_string: string, selection_mode: string, responses: Array<{ id: number, response_string: string, order: number|null, weight: number, linkId: number }> }|null>}
 */
export const getAllResponsesForTrigger = async (triggerString) => {
  if (
    !triggerString ||
    typeof triggerString !== "string" ||
    !triggerString.trim()
  )
    return null;
  try {
    const { data } = await api.get(
      "/api/trigger-responses/triggers/responses",
      {
        params: { trigger: triggerString.trim() },
      },
    );
    if (!data?.ok || !data.responses) return null;
    return {
      trigger_id: data.trigger_id,
      trigger_string: data.trigger_string,
      selection_mode: data.selection_mode,
      responses: data.responses,
    };
  } catch (_) {
    return null;
  }
};

/**
 * Get a random response string for the given trigger.
 * Uses GET /api/trigger-responses/random for all modes (random, ordered, weighted) so selection and frequency tracking happen on the server.
 * @param {string|{ trigger_string: string, selection_mode?: string }} triggerOrObject - Trigger string or object with trigger_string and selection_mode
 * @returns {Promise<string>} Response string or empty if none (e.g. 404)
 */
export const getRandomResponseForTrigger = async (triggerOrObject) => {
  const triggerString =
    typeof triggerOrObject === "string"
      ? triggerOrObject?.trim()
      : triggerOrObject?.trigger_string?.trim();

  if (!triggerString) return "";

  try {
    const { data } = await api.get("/api/trigger-responses/random", {
      params: { trigger: triggerString },
    });
    if (!data?.ok) return "";
    return data.response ?? "";
  } catch (_) {
    return "";
  }
};
