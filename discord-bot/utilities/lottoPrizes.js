/**
 * Lotto prize handlers built from webapi trigger_lotto_prizes catalog.
 */

import { timeoutMember } from "./timeoutMember.js";

/** @typedef {{ message: import("discord.js").Message, client: import("discord.js").Client, responseText: string }} LottoPrizeContext */

/** @type {Array<{ id: number, lotto_prize: string, fn: (context: LottoPrizeContext) => Promise<void> }>} */
let lottoPrizeHandlers = [];

const defaultPrizeFn = async () => {};

/** @type {Record<string, (context: LottoPrizeContext) => Promise<void>>} */
const PRIZE_FNS = {
  TAL_timeout: async ({ message, responseText }) => {
    // Pick random number 1-1000 inclusive
    const roll = Math.floor(Math.random() * 1000) + 1;
    if (roll === 1) {
      if (typeof message.member?.timeout === "function") {
        try {
          await timeoutMember(
            message.member,
            3 * 60, // 3 minutes in seconds
            "Lotto prize: Timeout for 3 minutes",
          );
          await message.reply(
            "CURSE OF RA𓀀 𓀁 𓀂 𓀃 𓀄 𓀅 𓀆 𓀇 𓀈 𓀉 𓀊 𓀋 𓀌 𓀍 𓀎 𓀏 𓀐 𓀑 𓀒 𓀓 𓀔",
          );
        } catch (err) {
          console.error("lotto TAL_timeout error:", err);
          await message.reply(
            "You were supposed to get a curse of ra but it broke somehow. Please tell Justin",
          );
        }
      } else {
        await message.reply(
          "Timeout not supported in this context! Tell Justin because he has no clue why you got this message",
        );
      }
    } else {
      if (responseText) {
        await message.reply(responseText);
      }
      console.log(`TAL roll: ${roll}`);
    }
  },
  placeholder_message: async () => {
    console.log("placeholder_message");
  },
};

/**
 * Resolve the handler function for a catalog prize string.
 * @param {string} prizeString
 * @returns {(context: LottoPrizeContext) => Promise<void>}
 */
function getPrizeFn(prizeString) {
  return PRIZE_FNS[prizeString] ?? defaultPrizeFn;
}

/**
 * Rebuild handlers from webapi catalog rows. Each row gets a placeholder fn.
 * @param {Array<{ id: number, prize_string: string }>} rows
 * @returns {void}
 */
export const rebuildLottoPrizeHandlers = (rows) => {
  lottoPrizeHandlers = (rows ?? []).map((row) => ({
    id: Number(row.id),
    lotto_prize: String(row.prize_string),
    fn: getPrizeFn(String(row.prize_string)),
  }));
};

/**
 * @returns {Array<{ id: number, lotto_prize: string, fn: (context: LottoPrizeContext) => Promise<void> }>}
 */
export const getLottoPrizeHandlers = () => lottoPrizeHandlers;

/**
 * Run the handler whose lotto_prize matches the given string (exact match).
 * @param {string} lottoPrize - From trigger_response.lotto_prize on selected response
 * @param {LottoPrizeContext} context - { message, client }
 * @returns {Promise<boolean>} true if a handler ran
 */
export const executeLottoPrize = async (lottoPrize, context) => {
  if (!lottoPrize || typeof lottoPrize !== "string") return false;
  const trimmed = lottoPrize.trim();
  if (!trimmed) return false;

  const handler = lottoPrizeHandlers.find((h) => h.lotto_prize === trimmed);
  if (!handler) {
    console.warn(`bot: no lotto prize handler for "${trimmed}"`);
    return false;
  }

  await handler.fn(context);
  return true;
};
