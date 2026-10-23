import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { confirmAccountLink } from "../../api/guildMembers.js";

const cmdName = "confirm-link";

const data = new SlashCommandBuilder()
  .setName("confirm-link")
  .setDescription("Confirm a pending request to link another account with yours");

const execute = async (interaction) => {
  const result = await confirmAccountLink(interaction.user.id);

  if (!result.ok) {
    console.log(`bot: confirm-link failed for ${interaction.user.id}: ${result.error}`);
  }

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: result.ok
      ? `Linked${result.requesterHandle ? ` account "${result.requesterHandle}"` : ""} to your identity.`
      : `Couldn't confirm link: ${result.error}`,
  });
};

export { cmdName, data, execute };
