/**
 * Trigger response function handlers built from webapi trigger_response_functions catalog.
 */

import { timeoutMember } from "./timeoutMember.js";

/** @typedef {{ message: import("discord.js").Message, client: import("discord.js").Client, responseText: string }} ResponseFunctionContext */

/** @type {Array<{ id: number, response_function: string, fn: (context: ResponseFunctionContext) => Promise<void> }>} */
let responseFunctionHandlers = [];

const defaultResponseFunction = async () => {};

/** @type {Record<string, (context: ResponseFunctionContext) => Promise<void>>} */
const RESPONSE_FUNCTIONS = {
  TAL_timeout: async ({ message, responseText }) => {
    // Pick random number 1-1000 inclusive
    const roll = Math.floor(Math.random() * 1000) + 1;
    if (roll === 1) {
      if (typeof message.member?.timeout === "function") {
        try {
          await timeoutMember(
            message.member,
            3 * 60, // 3 minutes in seconds
            "Trigger response function: timeout for 3 minutes",
          );
          await message.reply(
            "CURSE OF RA𓀀 𓀁 𓀂 𓀃 𓀄 𓀅 𓀆 𓀇 𓀈 𓀉 𓀊 𓀋 𓀌 𓀍 𓀎 𓀏 𓀐 𓀑 𓀒 𓀓 𓀔",
          );
        } catch (err) {
          console.error("response function TAL_timeout error:", err);
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
 * Resolve the handler function for a catalog function name.
 * @param {string} functionName
 * @returns {(context: ResponseFunctionContext) => Promise<void>}
 */
function getResponseFunction(functionName) {
  return RESPONSE_FUNCTIONS[functionName] ?? defaultResponseFunction;
}

/**
 * Rebuild handlers from webapi catalog rows. Each row gets a placeholder fn.
 * @param {Array<{ id: number, function_name: string }>} rows
 * @returns {void}
 */
export const rebuildResponseFunctionHandlers = (rows) => {
  responseFunctionHandlers = (rows ?? []).map((row) => ({
    id: Number(row.id),
    response_function: String(row.function_name),
    fn: getResponseFunction(String(row.function_name)),
  }));
};

/**
 * @returns {Array<{ id: number, response_function: string, fn: (context: ResponseFunctionContext) => Promise<void> }>}
 */
export const getResponseFunctionHandlers = () => responseFunctionHandlers;

/**
 * Run the handler whose response_function matches the given string (exact match).
 * @param {string} responseFunction - From trigger_response.response_function on selected response
 * @param {ResponseFunctionContext} context - { message, client }
 * @returns {Promise<boolean>} true if a handler ran
 */
export const executeResponseFunction = async (responseFunction, context) => {
  if (!responseFunction || typeof responseFunction !== "string") return false;
  const trimmed = responseFunction.trim();
  if (!trimmed) return false;

  const handler = responseFunctionHandlers.find(
    (h) => h.response_function === trimmed,
  );
  if (!handler) {
    console.warn(`bot: no response function handler for "${trimmed}"`);
    return false;
  }

  await handler.fn(context);
  return true;
};
