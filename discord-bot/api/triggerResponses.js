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
 * @returns {Promise<{ trigger_id: number, trigger_string: string, selection_mode: string, responses: Array<{ id: number, response_string: string, order: number|null, weight: number, response_function: string|null, linkId: number }> }|null>}
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
 * List trigger response function catalog rows from webapi.
 * GET /api/trigger-responses/functions
 * @returns {Promise<Array<{ id: number, function_name: string }>>}
 */
export const getTriggerResponseFunctionsList = async () => {
  try {
    const { data } = await api.get("/api/trigger-responses/functions");
    if (!data?.ok || !Array.isArray(data.responseFunctions)) return [];
    return data.responseFunctions.map((row) => ({
      id: Number(row.id),
      function_name: String(row.function_name),
    }));
  } catch (_) {
    return [];
  }
};

/**
 * Get a response for the given trigger.
 * Uses GET /api/trigger-responses/random for all modes (random, ordered, weighted) so selection and frequency tracking happen on the server.
 * @param {string|{ trigger_string: string, selection_mode?: string }} triggerOrObject - Trigger string or object with trigger_string and selection_mode
 * @param {string} [discordUserId] - Discord snowflake of the user receiving the response, so the server can log trigger_response_user_history
 * @returns {Promise<{ response: string, response_function: string|null }>} Response payload or empty response if none (e.g. 404)
 */
export const getRandomResponseForTrigger = async (
  triggerOrObject,
  discordUserId,
) => {
  const triggerString =
    typeof triggerOrObject === "string"
      ? triggerOrObject?.trim()
      : triggerOrObject?.trigger_string?.trim();

  if (!triggerString) return { response: "", response_function: null };

  try {
    const { data } = await api.get("/api/trigger-responses/random", {
      params: {
        trigger: triggerString,
        ...(discordUserId ? { app: "discord", userId: discordUserId } : {}),
      },
    });
    if (!data?.ok) return { response: "", response_function: null };
    const responseFunction =
      typeof data.response_function === "string" && data.response_function.trim()
        ? data.response_function.trim()
        : null;
    return {
      response: data.response ?? "",
      response_function: responseFunction,
    };
  } catch (_) {
    return { response: "", response_function: null };
  }
};
