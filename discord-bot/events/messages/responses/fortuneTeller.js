import { getFortuneResponse } from "../../../api/responses.js";

/**
 * Returns a random 8-ball fortune. The webapi does random selection and increment.
 * @param {string} _rawMessage - Unused; kept for signature compat
 * @param {string} _clientId - Unused; kept for signature compat
 * @returns {Promise<string>}
 */
export const fortuneTeller = async (_rawMessage, _clientId) => {
  return await getFortuneResponse();
};
