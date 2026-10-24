import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { requestAccountLink } from "../../api/guildMembers.js";

const cmdName = "link-accounts";

const data = new SlashCommandBuilder()
  .setName("link-accounts")
  .setDescription("Get a token to link your account with your account on another server");

const execute = async (interaction) => {
  const result = await requestAccountLink(interaction.user.id);

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: result.ok
      ? `Your link token is \`${result.token}\`. Run /confirm-link with this token from the account you want to link.`
      : `Couldn't request link: ${result.error}`,
  });
};

export { cmdName, data, execute };
