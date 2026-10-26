/** Platform max timeout: 1 day (unconfirmed against Fluxer's actual max; matches webapi's clamp). */
const MAX_TIMEOUT_SECONDS = 24 * 60 * 60;

/**
 * Time out a guild member for durationSeconds, validating bounds and moderation permission first.
 * @param {import('@fluxerjs/core').GuildMember} member
 * @param {number} durationSeconds
 * @param {string|null} [reason]
 * @returns {Promise<import('@fluxerjs/core').GuildMember>}
 */
export const timeoutMember = async (member, durationSeconds, reason) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Invalid timeout duration: ${durationSeconds} seconds`);
  }

  if (durationSeconds > MAX_TIMEOUT_SECONDS) {
    throw new Error(
      `Timeout duration exceeds platform maximum (${MAX_TIMEOUT_SECONDS} seconds)`,
    );
  }

  if (!member.moderatable) {
    throw new Error(
      `Cannot timeout member ${member.id}: missing permissions or role hierarchy`,
    );
  }

  const durationMs = Math.round(durationSeconds * 1000);
  return member.timeout(durationMs, reason ?? null);
};
