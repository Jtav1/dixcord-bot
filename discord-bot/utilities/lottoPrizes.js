/**
 * Lotto prize handlers built from webapi trigger_lotto_prizes catalog.
 */

/** @typedef {{ message: import("discord.js").Message, client: import("discord.js").Client }} LottoPrizeContext */

/** @type {Array<{ id: number, lotto_prize: string, fn: (context: LottoPrizeContext) => Promise<void> }>} */
let lottoPrizeHandlers = [];

const defaultPlaceholderFn = async () => {};

/** @type {Record<string, (context: LottoPrizeContext) => Promise<void>>} */
const PLACEHOLDER_FNS = {
  TAL_timeout: async ({ message }) => {
    // Pick random number 1-1000 inclusive
    const roll = Math.floor(Math.random() * 1000) + 1;
    if (roll === 1) {
      if (typeof message.member?.timeout === "function") {
        try {
          await message.member.timeout(
            3 * 60 * 1000, // 3 minutes in ms
            "Lotto prize: Timeout for 3 minutes",
          );
          await message.reply(
            "you rolled a 1. CURSE OF RA𓀀 𓀁 𓀂 𓀃 𓀄 𓀅 𓀆 𓀇 𓀈 𓀉 𓀊 𓀋 𓀌 𓀍 𓀎 𓀏 𓀐 𓀑 𓀒 𓀓 𓀔",
          );
        } catch (err) {
          await message.reply(
            "Rolled a 1 but youre an admin or something. Respectfully time yourself out.",
          );
        }
      } else {
        await message.reply(
          "Timeout not supported in this context! Tell Justin because he has no clue why you got this message",
        );
      }
    } else {
      //await message.reply(`Lucky! You rolled a ${roll}, so no timeout this time.`);
      console.log(`TAL roll: ${roll}`);
    }
  },
  placeholder_message: async () => {
    console.log("placeholder_message");
  },
};

/**
 * Resolve a placeholder function for a catalog prize string.
 * @param {string} prizeString
 * @returns {(context: LottoPrizeContext) => Promise<void>}
 */
function getPlaceholderFn(prizeString) {
  return PLACEHOLDER_FNS[prizeString] ?? defaultPlaceholderFn;
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
    fn: getPlaceholderFn(String(row.prize_string)),
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
