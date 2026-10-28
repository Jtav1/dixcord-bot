import { EmbedBuilder } from "@fluxerjs/builders";

import { getTopScores, getBottomScores } from "../../api/plusplus.js";

const cmdName = "plusplus-leaderboard";
const featureKey = "plusplus_enabled";

const data = {
  description: "Top and bottom 5 plusplus scores",
  usage: "plusplus-leaderboard",
};

const execute = async (message) => {
  const top = await getTopScores(5);
  const bottom = await getBottomScores(5);

  const voteEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("PlusPlus Leaderboard")
    .setThumbnail("https://i.imgur.com/KMroCAv.png")
    .addFields(
      {
        name: "🏆 Top Scores",
        value: top
          .map((item) => `**${item.total}** : ${item.typestr === "user" ? "<@" + item.string + ">" : item.string}`)
          .join("\n"),
        inline: true,
      },
      {
        name: "🗑️ Bottom Scores",
        value: bottom
          .map((item) => `**${item.total}** : ${item.typestr === "user" ? "<@" + item.string + ">" : item.string}`)
          .join("\n"),
        inline: true,
      },
    )
    .setFooter({ text: "Updated just now" });

  await message.reply({ embeds: [voteEmbed] });
};

export { cmdName, data, execute, featureKey };
