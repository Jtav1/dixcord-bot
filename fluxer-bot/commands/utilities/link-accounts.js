import { requestAccountLink } from "../../api/guildMembers.js";

const cmdName = "link-accounts";

const data = {
  description: "Get a token to link your account with your account on another server",
  usage: "link-accounts",
};

const execute = async (message) => {
  const result = await requestAccountLink(message.author.id);

  if (!result.ok) {
    await message.reply(`Couldn't request link: ${result.error}`);
    return;
  }

  const dm = await message.author.createDM();
  await dm.send(
    `Your link token is \`${result.token}\`. Run confirm-link with this token from the account you want to link.`,
  );
  await message.reply("Check your DMs for your link token.");
};

export { cmdName, data, execute };
