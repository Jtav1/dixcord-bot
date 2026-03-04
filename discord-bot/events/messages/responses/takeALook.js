import { takeALook as getTakeALookResponse } from "../../../api/responses.js";

/**
 * Take-a-look response: random image URL, "No spam!", or empty if over limit.
 * All logic (rate limit, rare/common, increment) is in the webapi.
 */
export const takeALook = async () => {
  return await getTakeALookResponse();
};
