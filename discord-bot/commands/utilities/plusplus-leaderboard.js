import { SlashCommandBuilder } from "discord.js";
import { getTopScores, getBottomScores } from '../../database/plusplus.js';
import { EmbedBuilder } from "discord.js";

const cmdName = "plusplus-leaderboard";

const data = new SlashCommandBuilder()
  .setName("plusplus-leaderboard")
  .setDescription("Top and bottom 5 plusplus scores");

const execute = async (interaction) => {
  let top = await getTopScores(5);
  let bottom = await getBottomScores(5);

  // Create a cleaner embed using markdown
  const voteEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("PlusPlus Leaderboard")
    .setThumbnail("https://i.imgur.com/KMroCAv.png")
    .addFields(
      { 
        name: "🏆 Top Scores", 
        value: top.map((item) => `**${item.total}** : ${(item.typestr === "user" ? "<@" + item.string + ">" : item.string)}`).join('\n'),
        inline: true
      },
      { 
        name: "🗑️ Bottom Scores", 
        value: bottom.map((item) => `**${item.total}** : ${(item.typestr === "user" ? "<@" + item.string + ">" : item.string)}`).join('\n'),
        inline: true 
      }
    )
    .setFooter({ text: "Updated just now" });

  await interaction.reply({ embeds: [voteEmbed] });
};

export { cmdName, data, execute };
