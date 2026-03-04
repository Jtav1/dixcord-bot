import * as api from "./client.js";

/**
 * Take-a-look response (random image URL or rate-limit message). POST /api/bot-responses/take-a-look.
 * The webapi handles links, rate limit, and increment.
 * @returns {Promise<string>}
 */
export const takeALook = async () => {
  const { data } = await api.post("/api/bot-responses/take-a-look");
  if (!data?.ok) return "";
  return data.response ?? "";
};

/**
 * Random 8-ball fortune. POST /api/bot-responses/fortune.
 * @returns {Promise<string>}
 */
export const getFortuneResponse = async () => {
  const { data } = await api.post("/api/bot-responses/fortune");
  if (!data?.ok) return "";
  return data.response ?? "";
};

/**
 * Link-fixer response for social links (x/twitter, instagram, tiktok, bsky). POST /api/bot-responses/link-fixer.
 * The webapi uses config and link_replacements; no processing in the bot.
 * @param {string} message - Raw message content
 * @returns {Promise<string>}
 */
export const getLinkFixerResponse = async (message) => {
  if (!message) return "";
  const { data } = await api.post("/api/bot-responses/link-fixer", {
    message: String(message),
  });
  if (!data?.ok) return "";
  return data.response ?? "";
};
