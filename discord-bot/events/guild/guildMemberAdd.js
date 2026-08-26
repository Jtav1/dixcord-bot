import { importUserMappingList } from "../../api/userMapping.js";

const name = "guildMemberAdd";

/**
 * Sync a newly-joined member into chat_member_mapping immediately.
 * Without this, a member who joins after boot and reacts/sends an emoji before any other
 * sync runs is unknown to webapi, which rejects the emoji-count call and previously crashed
 * the bot (see countEmoji/countSticker error handling in emojiDetector.js/stickerDetector.js).
 * @param {import('discord.js').GuildMember} member
 */
const execute = async (member) => {
  if (member.user.bot) return;

  const u = member.user;
  await importUserMappingList([
    {
      name: String(member.displayName || u.globalName || u.username || u.id),
      discord_handle: String(u.username ?? ""),
      discord_id: String(u.id),
    },
  ]);
};

export const event = {
  name: name,
  execute: execute,
  once: false,
};
