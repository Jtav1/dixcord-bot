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
 * Get a random response string for the given trigger.
 * GET /api/trigger-responses/random?trigger=xxx
 * @param {string} trigger - Trigger string that was matched
 * @returns {Promise<string>} Response string or empty if none (e.g. 404)
 */
export const getRandomResponseForTrigger = async (trigger) => {
  if (!trigger || typeof trigger !== "string" || !trigger.trim()) return "";
  try {
    const { data } = await api.get("/api/trigger-responses/random", {
      params: { trigger: trigger.trim() },
    });
    if (!data?.ok) return "";
    return data.response ?? "";
  } catch (_) {
    return "";
  }
};
