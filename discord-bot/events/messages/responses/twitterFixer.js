import { getLinkFixerResponse } from "../../../api/responses.js";

/**
 * Returns a fixed embed-friendly link if the message contains a social link and trigger.
 * All logic (config, link_replacements) is in the webapi.
 * @param {string} messageContents - Raw message content
 * @returns {Promise<string>}
 */
export const twitterFixer = async (messageContents) => {
  return await getLinkFixerResponse(messageContents ?? "");
};
