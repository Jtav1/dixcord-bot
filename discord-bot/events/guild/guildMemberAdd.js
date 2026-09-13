import { syncSingleGuildMember } from "../../api/guildMembers.js";
import { incrementCounter } from "../../utilities/metrics.js";

const name = "guildMemberAdd";

/**
 * Sync a newly-joined member into guild_members immediately, without waiting for the next
 * periodic sync. Does not create or link a chat_member_mapping identity — that's always a
 * separate, manual admin action, so a brand-new member stays unresolved for other features
 * (e.g. emoji/plusplus tracking) until an admin links them.
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
