/** Discord maximum timeout length: 1 day */
const MAX_TIMEOUT_SECONDS = 24 * 60 * 60;

/**
 * Timeout a guild member (communication disabled) for a given number of seconds.
 * Uses GuildMember#timeout via discord.js (duration converted to milliseconds).
 * Requires the bot to have Moderate Members permission and a higher role than the target.
 * @param {import("discord.js").GuildMember} member - Guild member to timeout
 * @param {number} durationSeconds - Duration in seconds (minimum 1, maximum 1 day)
 * @param {string} [reason] - Optional audit log reason
 * @returns {Promise<import("discord.js").GuildMember>} Updated member after timeout
 * @throws {Error} If duration is invalid or the member cannot be moderated
 */
export const timeoutMember = async (member, durationSeconds, reason) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Invalid timeout duration: ${durationSeconds} seconds`);
  }

  if (durationSeconds > MAX_TIMEOUT_SECONDS) {
    throw new Error(
      `Timeout duration exceeds Discord maximum (${MAX_TIMEOUT_SECONDS} seconds)`,
    );
  }

  if (!member.moderatable) {
    throw new Error(
      `Cannot timeout member ${member.user.tag} (${member.id}): missing permissions or role hierarchy`,
    );
  }

  const durationMs = Math.round(durationSeconds * 1000);
  return member.timeout(durationMs, reason ?? null);
};
