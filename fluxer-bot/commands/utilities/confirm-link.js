import { confirmAccountLink } from "../../api/guildMembers.js";

const cmdName = "confirm-link";

const data = {
  description: "Confirm a pending account link using the token you were given",
  usage: "confirm-link <token>",
};

const execute = async (message, args) => {
  const token = args[0]?.trim();
  if (!token) {
    await message.reply(`Usage: ${data.usage}`);
    return;
  }

  const result = await confirmAccountLink(message.author.id, token);

  if (!result.ok) {
    console.log(`bot: confirm-link failed for ${message.author.id}: ${result.error}`);
  }

  await message.reply(
    result.ok
      ? `Linked${result.requesterHandle ? ` account "${result.requesterHandle}"` : ""} to your identity.`
      : `Couldn't confirm link: ${result.error}`,
  );
};

export { cmdName, data, execute };
