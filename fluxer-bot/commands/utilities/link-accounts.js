import { requestAccountLink } from "../../api/guildMembers.js";

const cmdName = "link-accounts";

const data = {
  description: "Request to link your account with your account on another server",
  usage: "link-accounts <user-id>",
};

const execute = async (message, args) => {
  const targetUserId = args[0]?.trim();
  if (!targetUserId) {
    await message.reply(`Usage: ${data.usage}`);
    return;
  }

  const result = await requestAccountLink(message.author.id, targetUserId);
  await message.reply(
    result.ok
      ? "Link requested. Now run confirm-link from that account on the other server to finish."
      : `Couldn't request link: ${result.error}`,
  );
};

export { cmdName, data, execute };
