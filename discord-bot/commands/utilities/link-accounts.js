import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { requestAccountLink } from "../../api/guildMembers.js";

const cmdName = "link-accounts";

const data = new SlashCommandBuilder()
  .setName("link-accounts")
  .setDescription("Request to link your account with your account on another server")
  .addStringOption((option) =>
    option
      .setName("user-id")
      .setDescription("Your user ID on the other server (they must then run /confirm-link)")
      .setRequired(true),
  );

const execute = async (interaction) => {
  const targetUserId = interaction.options.getString("user-id").trim();
  const result = await requestAccountLink(interaction.user.id, targetUserId);

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: result.ok
      ? "Link requested. Now run confirm-link from that account on the other server to finish."
      : `Couldn't request link: ${result.error}`,
  });
};

export { cmdName, data, execute };
