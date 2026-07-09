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
    // Pick a random integer between 1 and 1000. If it's 1000, timeout user for 2 minutes.
    const roll = Math.floor(Math.random() * 1000) + 1;
    if (roll === 1000) {
      if (typeof message.member?.timeout === "function") {
        try {
          await message.member.timeout(
            2 * 60 * 1000,
            "Lotto prize: Timeout for 2 minutes",
          );
          await message.reply(
            "WOW! You rolled a 1000 and got timed out for 2 minutes 😈",
          );
        } catch (err) {
          await message.reply(
            "I tried to timeout you but you're an admin or something",
          );
        }
      } else {
        await message.reply("Timeout not supported in this context!");
      }
    } else {
      await message.reply(`You rolled a ${roll}. No timeout this time!`);
    }
  },
  placeholder_message: async () => {},
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
