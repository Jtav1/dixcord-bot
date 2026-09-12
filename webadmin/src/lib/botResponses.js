import { apiFetchJson } from "./http.js";

/**
 * Get a random 8-ball fortune (diagnostic for eight_ball_enabled).
 * @returns {Promise<string>}
 */
export async function testFortune() {
  const data = await apiFetchJson("POST", "/bot-responses/fortune", {}, "Fortune");
  return data.response;
}

/**
 * Test the social-link fixer against a sample message (diagnostic for twitter_fix_enabled).
 * @param {string} message
 * @returns {Promise<string>} Empty string if no fix applied.
 */
export async function testLinkFixer(message) {
  const data = await apiFetchJson(
    "POST",
    "/bot-responses/link-fixer",
    { message },
    "Link fixer",
  );
  return data.response;
}
