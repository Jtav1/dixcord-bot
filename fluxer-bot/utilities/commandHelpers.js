/** Shared helpers for prefix commands (fluxer.js has no slash commands). */

const mentionRegex = /^<@!?(\d+)>$/;

/** Universal cancel word for any DM prompt-response chain (e.g. the !scheduled-update wizard). */
const exitRegex = /^exit$/i;

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isExitCommand(text) {
  return exitRegex.test(text.trim());
}

/**
 * Extract a user id from a `<@id>`/`<@!id>` mention token.
 * @param {string|undefined} arg
 * @returns {string|null}
 */
export function parseUserMention(arg) {
  const match = arg?.match(mentionRegex);
  return match ? match[1] : null;
}

/**
 * DM the invoker basic usage instructions for a command (missing/invalid param). DM failure
 * (e.g. closed DMs) is non-fatal, same tolerance as other cosmetic sends in this codebase.
 * @param {import('@fluxerjs/core').Message} message
 * @param {{ cmdName: string, data: { description: string, usage: string } }} command
 */
export async function sendUsageError(message, command) {
  await message.author
    .send(`Usage: \`${command.data.usage}\`\n${command.data.description}`)
    .catch(() => null);
}
