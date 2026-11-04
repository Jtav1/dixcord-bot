import { randomInt } from "node:crypto";

import { getColorRole, setColorRole, clearColorRole } from "../api/guildMembers.js";
import { botTopRolePosition, manageRolesBlockReason, roleBlockReason } from "./roleChecks.js";

const ROLE_NAME_RE = /^dixbot-[a-z0-9]{5}$/;
const NAME_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const HEX_RE = /^#?([0-9a-f]{6})$/i;
const REASON = "!color-me";

/** User ids with a color-me change in flight, so rapid repeats can't create two roles. */
const inFlight = new Set();

/** An expected failure whose message is safe to show the user. */
export class ColorRoleError extends Error {}

/**
 * @param {string|undefined} arg
 * @returns {string|null} 6 uppercase hex digits (no `#`), or null if invalid.
 */
export function parseHex(arg) {
  const match = arg?.trim().match(HEX_RE);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Run `fn` unless this user already has a color change running.
 * @template T
 * @param {string} userId
 * @param {() => Promise<T>} fn
 * @returns {Promise<{ busy: true } | { busy: false, value: T }>}
 */
export async function withUserLock(userId, fn) {
  if (inFlight.has(userId)) return { busy: true };
  inFlight.add(userId);
  try {
    return { busy: false, value: await fn() };
  } finally {
    inFlight.delete(userId);
  }
}

/**
 * @param {import('@fluxerjs/core').Guild} guild
 * @param {string} name
 * @returns {import('@fluxerjs/core').Role|undefined}
 */
function findRoleByName(guild, name) {
  return guild.roles.find((r) => r.name === name);
}

/**
 * @param {import('@fluxerjs/core').Guild} guild
 * @returns {string} A `dixbot-#####` name not used by any current role.
 */
function generateRoleName(guild) {
  for (let attempt = 0; attempt < 20; attempt++) {
    let suffix = "";
    for (let i = 0; i < 5; i++) suffix += NAME_CHARS[randomInt(NAME_CHARS.length)];
    const name = `dixbot-${suffix}`;
    if (!findRoleByName(guild, name)) return name;
  }
  throw new Error("could not generate an unused color role name");
}

/**
 * @param {import('@fluxerjs/core').Guild} guild
 * @param {import('@fluxerjs/core').GuildMember} member
 * @returns {import('@fluxerjs/core').Role[]} The bot-created color roles this member holds.
 */
function heldColorRoles(guild, member) {
  return [...member.roles.roleIds]
    .map((id) => guild.roles.get(id))
    .filter((role) => role && ROLE_NAME_RE.test(role.name));
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isLocked(err) {
  return err?.statusCode === 423 || err?.cause?.statusCode === 423;
}

/**
 * Move a new color role to just under the bot's top role. Best effort: on failure the role
 * simply stays lower, which still works but may be outranked by the member's other colored roles.
 * @param {import('@fluxerjs/core').Guild} guild
 * @param {import('@fluxerjs/core').Role} role
 * @returns {Promise<void>}
 */
async function positionBelowBot(guild, role) {
  const position = botTopRolePosition(guild) - 1;
  if (position < 1) return;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await guild.setRolePositions([{ id: role.id, position }]);
      return;
    } catch (err) {
      // fluxer.js maps the PATCH response as a list; the API answers 204, so a TypeError here
      // means the reorder itself succeeded (the cache follows via the bulk-update event).
      if (err instanceof TypeError) return;
      if (attempt === 0 && isLocked(err)) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      console.error(`bot: failed to position color role ${role.name}:`, err);
      return;
    }
  }
}

/**
 * Create or update the member's personal color role and assign it.
 * @param {import('@fluxerjs/core').Guild} guild
 * @param {import('@fluxerjs/core').GuildMember} member
 * @param {string} hex 6 uppercase hex digits.
 * @returns {Promise<void>}
 * @throws {ColorRoleError} For failures the user should be told about.
 */
export async function applyColorRole(guild, member, hex) {
  const blocked = await manageRolesBlockReason(guild);
  if (blocked) {
    console.error(`bot: color-me cannot manage roles: ${blocked}`);
    throw new ColorRoleError("I don't have permission to manage roles, so I can't set your color.");
  }

  const color = parseInt(hex, 16);
  const record = await getColorRole(member.id);
  const held = heldColorRoles(guild, member);

  // Prefer the recorded role; else adopt one the member already holds (record lost).
  let role = (record && findRoleByName(guild, record.name)) || held.find((r) => r.name === record?.name) || held[0];
  let created = false;

  if (role) {
    const roleBlock = await roleBlockReason(guild, role);
    if (roleBlock) {
      console.error(`bot: color-me cannot edit ${role.name}: ${roleBlock}`);
      throw new ColorRoleError("I can't edit your color role — ask an admin to check my role's position.");
    }
    if (role.color !== color) await role.edit({ color, reason: REASON });
  } else {
    const name = record?.name ?? generateRoleName(guild);
    try {
      role = await guild.createRole({ name, color, permissions: "0", reason: REASON });
    } catch (err) {
      console.error("bot: color-me failed to create role:", err);
      throw new ColorRoleError("I couldn't create your color role (the server may be at its role limit).");
    }
    created = true;
    await positionBelowBot(guild, role);
  }

  try {
    await member.roles.add(role.id);
  } catch (err) {
    console.error(`bot: color-me failed to assign ${role.name} to ${member.id}:`, err);
    if (created) await role.delete(REASON).catch(() => null);
    throw new ColorRoleError("I couldn't give you the color role — ask an admin to check my role's position.");
  }

  // Exactly one color role per member.
  for (const extra of heldColorRoles(guild, member)) {
    if (extra.id !== role.id) await member.roles.remove(extra.id).catch(() => null);
  }

  await setColorRole(member.id, { name: role.name, hex });
}

/**
 * Delete a user's color role(s) and clear the record. `member` is omitted when they've left.
 * @param {import('@fluxerjs/core').Guild} guild
 * @param {string} userId
 * @param {import('@fluxerjs/core').GuildMember|null} [member]
 * @returns {Promise<boolean>} False if there was nothing to remove.
 * @throws {ColorRoleError} For failures the user should be told about.
 */
export async function removeColorRole(guild, userId, member = null) {
  const record = await getColorRole(userId);
  const roles = new Map();
  const recorded = record && findRoleByName(guild, record.name);
  if (recorded) roles.set(recorded.id, recorded);
  if (member) for (const role of heldColorRoles(guild, member)) roles.set(role.id, role);
  if (!record && roles.size === 0) return false;

  for (const role of roles.values()) {
    const roleBlock = await roleBlockReason(guild, role);
    if (roleBlock) {
      console.error(`bot: color-me cannot delete ${role.name}: ${roleBlock}`);
      throw new ColorRoleError("I can't remove your color role — ask an admin to check my role's position.");
    }
    if (member) await member.roles.remove(role.id).catch(() => null);
    await role.delete(REASON);
  }
  await clearColorRole(userId);
  return true;
}
