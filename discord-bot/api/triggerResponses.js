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
 * List all triggers with id and selection_mode (for weighted/random/ordered/lotto handling).
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
 * @returns {Promise<{ trigger_id: number, trigger_string: string, selection_mode: string, responses: Array<{ id: number, response_string: string, order: number|null, weight: number, lotto_prize: string|null, linkId: number }> }|null>}
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
 * List lotto prize catalog rows from webapi.
 * GET /api/trigger-responses/lotto-prizes
 * @returns {Promise<Array<{ id: number, prize_string: string }>>}
 */
export const getLottoPrizesList = async () => {
  try {
    const { data } = await api.get("/api/trigger-responses/lotto-prizes");
    if (!data?.ok || !Array.isArray(data.lottoPrizes)) return [];
    return data.lottoPrizes.map((row) => ({
      id: Number(row.id),
      prize_string: String(row.prize_string),
    }));
  } catch (_) {
    return [];
  }
};

/**
 * Get a response for the given trigger.
 * Uses GET /api/trigger-responses/random for all modes (random, ordered, weighted, lotto) so selection and frequency tracking happen on the server.
 * @param {string|{ trigger_string: string, selection_mode?: string }} triggerOrObject - Trigger string or object with trigger_string and selection_mode
 * @returns {Promise<{ response: string, lotto_prize: string|null }>} Response payload or empty response if none (e.g. 404)
 */
export const getRandomResponseForTrigger = async (triggerOrObject) => {
  const triggerString =
    typeof triggerOrObject === "string"
      ? triggerOrObject?.trim()
      : triggerOrObject?.trigger_string?.trim();

  if (!triggerString) return { response: "", lotto_prize: null };

  try {
    const { data } = await api.get("/api/trigger-responses/random", {
      params: { trigger: triggerString },
    });
    if (!data?.ok) return { response: "", lotto_prize: null };
    const lottoPrize =
      typeof data.lotto_prize === "string" && data.lotto_prize.trim()
        ? data.lotto_prize.trim()
        : null;
    return {
      response: data.response ?? "",
      lotto_prize: lottoPrize,
    };
  } catch (_) {
    return { response: "", lotto_prize: null };
  }
};
