import { Events } from "@fluxerjs/core";

import { guildId } from "../../configVars.js";
import { syncSingleGuildMember } from "../../api/guildMembers.js";

const name = Events.GuildMemberAdd;

/**
 * Sync a newly-joined member into guild_members immediately. Does not link a
 * chat_member_mapping identity — that stays a separate, manual admin action.
 * @param {import('@fluxerjs/core').GuildMember} member
 */
const execute = async (member) => {
  if (member.guild.id !== guildId || member.user.bot) return;

  await syncSingleGuildMember(member);
};

export const event = {
  name: name,
  execute: execute,
  once: false,
};
