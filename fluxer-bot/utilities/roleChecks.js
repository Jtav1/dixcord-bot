import { PermissionFlags } from "@fluxerjs/core";

/**
 * The bot's own member, fetched when not yet cached (`members.me` is cache-only).
 * @param {import('@fluxerjs/core').Guild} guild
 * @returns {Promise<import('@fluxerjs/core').GuildMember|null>}
 */
async function getBotMember(guild) {
  if (!guild.members.me) {
    await guild.members.fetchMe().catch(() => null);
  }
  return guild.members.me ?? null;
}

/**
 * Position of the bot's highest role (-1 if the bot member isn't cached).
 * @param {import('@fluxerjs/core').Guild} guild
 * @returns {number}
 */
export function botTopRolePosition(guild) {
  let top = -1;
  for (const r of guild.members.me?.roles.cache.values() ?? []) top = Math.max(top, r.position);
  return top;
}

/**
 * Whether the bot can manage roles at all (member available + Manage Roles).
 * @param {import('@fluxerjs/core').Guild} guild
 * @returns {Promise<string|null>} Reason it can't, or null if it can.
 */
export async function manageRolesBlockReason(guild) {
  const me = await getBotMember(guild);
  if (!me) return "bot's own member unavailable";
  if (!me.permissions.has(PermissionFlags.ManageRoles)) return "bot lacks Manage Roles";
  return null;
}

/**
 * fluxer.js has no `GuildMember.manageable`; check ManageRoles + that the role sits below the bot's top role.
 * @param {import('@fluxerjs/core').Guild} guild
 * @param {import('@fluxerjs/core').Role|undefined} role
 * @returns {Promise<string|null>} Reason it can't be managed, or null if it can.
 */
export async function roleBlockReason(guild, role) {
  if (!role) return "role not found in guild cache";
  if (role.managed) return "role is managed (integration/bot role)";
  const blocked = await manageRolesBlockReason(guild);
  if (blocked) return blocked;
  const top = botTopRolePosition(guild);
  if (role.position >= top) return `role position ${role.position} >= bot's highest ${top}`;
  return null;
}
