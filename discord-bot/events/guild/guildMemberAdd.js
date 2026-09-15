import { syncSingleGuildMember } from "../../api/guildMembers.js";
import { incrementCounter } from "../../utilities/metrics.js";

const name = "guildMemberAdd";

/**
 * Sync a newly-joined member into guild_members immediately. Does not link a
 * chat_member_mapping identity — that stays a separate, manual admin action.
 * @param {import('discord.js').GuildMember} member
 */
const execute = async (member) => {
  if (member.user.bot) return;

  await syncSingleGuildMember(member);
  incrementCounter("guildMemberJoinsTotal");
};

export const event = {
  name: name,
  execute: execute,
  once: false,
};
