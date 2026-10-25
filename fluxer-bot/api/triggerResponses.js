import * as api from "./client.js";

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
 * @param {string} [fluxerUserId] - Fluxer user id of the user receiving the response, so the server can log trigger_response_user_history
 * @returns {Promise<{ response: string, response_function: string|null, response_function_parameters: Record<string, unknown>|null, milestones: Array }>} Response payload or empty response if none (e.g. 404)
 */
export const getRandomResponseForTrigger = async (
  triggerOrObject,
  fluxerUserId,
) => {
  const empty = {
    response: "",
    response_function: null,
    response_function_parameters: null,
    milestones: [],
  };
  const triggerString =
    typeof triggerOrObject === "string"
      ? triggerOrObject?.trim()
      : triggerOrObject?.trigger_string?.trim();

  if (!triggerString) return empty;

  try {
    const { data } = await api.get("/api/trigger-responses/random", {
      params: {
        trigger: triggerString,
        ...(fluxerUserId ? { app: "fluxer", userId: fluxerUserId } : {}),
      },
    });
    if (!data?.ok) return empty;
    const responseFunction =
      typeof data.response_function === "string" && data.response_function.trim()
        ? data.response_function.trim()
        : null;
    const responseFunctionParameters =
      data.response_function_parameters &&
      typeof data.response_function_parameters === "object" &&
      !Array.isArray(data.response_function_parameters)
        ? data.response_function_parameters
        : null;
    return {
      response: data.response ?? "",
      response_function: responseFunction,
      response_function_parameters: responseFunctionParameters,
      milestones: Array.isArray(data.milestones) ? data.milestones : [],
    };
  } catch (_) {
    return empty;
  }
};
