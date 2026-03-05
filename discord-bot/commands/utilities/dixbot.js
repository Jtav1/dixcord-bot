import { SlashCommandBuilder } from "discord.js";

const cmdName = "dixbot";

const data = new SlashCommandBuilder()
  .setName("dixbot")
  .setDescription("Command reference");

const execute = async (interaction) => {
  await interaction.reply(
    'Justin decided to not keep this command updated. Check out the readme at https://github.com/Jtav1/dixcord-bot to see what I can do.'
  );
};

export { cmdName, data, execute };
