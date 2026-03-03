import { SlashCommandBuilder } from "discord.js";
import { getTopEmoji } from "../../database/emojis.js";

import { EmbedBuilder } from "discord.js";

const cmdName = "top-emojis";

const data = new SlashCommandBuilder()
  .setName("top-emojis")
  .setDescription("Top 5 Most Used Emojis in Dixcord");

const execute = async (interaction) => {
  let top5 = await getTopEmoji(5);

  let emoStr = "Top 5 most used emojis:\n\n";
  top5.forEach((em, idx) => {
    let num = idx + 1;
    //prettier-ignore
    emoStr += '\n\t' + num + ' - ' + em.emoji + ', ' + em.frequency + (em.animated ? ' <a:' : ' <:') + em.emoji + ':' + em.emoid + '>';
  });

  const emojiEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Top 5 Emojis")
    .setDescription(emoStr)
    .setThumbnail("https://i.imgur.com/KMroCAv.png");

  await interaction.reply({ embeds: [emojiEmbed] });
};

export { cmdName, data, execute };
