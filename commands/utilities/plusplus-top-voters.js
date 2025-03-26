import { SlashCommandBuilder } from 'discord.js';
import { getTopVoters } from '../../middleware/plusplus.js';
import { EmbedBuilder } from "discord.js";

const cmdName = 'plusplus-top-voters';

const data = new SlashCommandBuilder()
  .setName('plusplus-top-voters')
  .setDescription('The top 3 plusplus voters');

const execute = async (interaction) => {
  let topVoters = await getTopVoters(3);

  let outStr = "Top 3 plusplus voters:\n\n";
  topVoters.forEach((voter, idx) => {
    let num = idx + 1;
    outStr += `\n\t${num} - <@${voter.voter}> has cast ${voter.total} votes`;
  });

  const voterEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Top 3 plusplus voters")
    .setDescription(outStr)
    .setThumbnail("https://i.imgur.com/KMroCAv.png");

  await interaction.reply({ embeds: [voterEmbed] });
};

export { cmdName, data, execute };
