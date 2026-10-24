/**
 * Trigger response function handlers built from webapi trigger_response_functions catalog.
 */

/** @typedef {{ message: import("@fluxerjs/core").Message, client: import("@fluxerjs/core").Client, responseText: string, parameters?: Record<string, unknown>|null }} ResponseFunctionContext */

/** @type {Array<{ id: number, response_function: string, fn: (context: ResponseFunctionContext) => Promise<void> }>} */
let responseFunctionHandlers = [];

const defaultResponseFunction = async () => {};

/** @type {Record<string, (context: ResponseFunctionContext) => Promise<void>>} */
const RESPONSE_FUNCTIONS = {
  // discord-bot's TAL_timeout calls GuildMember#timeout() — no confirmed fluxer.js moderation
  // equivalent yet (tracked under FEATURE_PARITY.md's "Timeout vote" section). Stub to a plain
  // reply so a trigger response referencing it doesn't silently no-op or throw.
  TAL_timeout: async ({ message, responseText }) => {
    console.log("bot: TAL_timeout response function not yet supported on fluxer-bot");
    if (responseText) {
      await message.reply(responseText);
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
