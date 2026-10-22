import { confirmAccountLink } from "../../api/guildMembers.js";

const cmdName = "confirm-link";

const data = {
  description: "Confirm a pending request to link another account with yours",
  usage: "confirm-link",
};

const execute = async (message) => {
  const result = await confirmAccountLink(message.author.id);

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
