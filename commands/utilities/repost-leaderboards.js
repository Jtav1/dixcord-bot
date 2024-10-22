import { EmbedBuilder } from "discord.js";

import { SlashCommandBuilder } from "discord.js";
import { getTopReposters } from "../../middleware/emojis.js";
import { getAllConfigurations } from "../../middleware/configurations.js";

const cmdName = "top-reposters";
const repostEmojiId = "1072368151922233404"; // use db for this somehow

const data = new SlashCommandBuilder()
  .setName("top-reposters")
  .setDescription("Top 5 Worst Reposters in Dixcord");

const execute = async (interaction) => {
  let top5 = await getTopReposters(5);

  let replyStr =
    "Top 5 users with the most <:repost:" +
    repostEmojiId +
    "> accusations:\n\n";
  top5.forEach((userRow, idx) => {
    let num = idx + 1;
    //prettier-ignore
    replyStr += '\n\t' + num + " - " + "<@" + userRow.userid  + ">" + " - " + userRow.count + " accusations";
  });

  const repostEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Top 5 Reposters")
    .setDescription(replyStr)
    .setThumbnail("https://i.imgur.com/KMroCAv.png");

  await interaction.reply({ embeds: [repostEmbed] });
};

export { cmdName, data, execute };
