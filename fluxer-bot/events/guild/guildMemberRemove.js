import { Events } from "@fluxerjs/core";

import { guildId } from "../../configVars.js";
import { removeColorRole } from "../../utilities/colorRole.js";

const name = Events.GuildMemberRemove;

/**
 * Delete a departing member's color role and clear their record. Not gated on the color_me
 * feature flag, so cleanup still happens if the command is later switched off.
 * @param {import('@fluxerjs/core').GuildMember|import('@fluxerjs/core').PartialGuildMember} member
 */
const execute = async (member) => {
  if (member.guild.id !== guildId || member.user?.bot) return;

  try {
    await removeColorRole(member.guild, member.id);
  } catch (err) {
    console.error(`bot: failed to clean up color role for departed member ${member.id}:`, err);
  }
};

export const event = {
  name: name,
  execute: execute,
  once: false,
};
