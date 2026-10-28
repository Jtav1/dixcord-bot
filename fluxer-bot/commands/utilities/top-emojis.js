import { EmbedBuilder } from "@fluxerjs/builders";

import { getTopEmoji } from "../../api/emojis.js";

const cmdName = "top-emojis";
const featureKey = "emoji_tracking_enabled";

const data = {
  description: "Top 5 most used emojis",
  usage: "top-emojis",
};

const execute = async (message) => {
  const top5 = await getTopEmoji(5);

  let emoStr = "Top 5 most used emojis:\n\n";
  top5.forEach((entry, idx) => {
    const emoji = entry.emoji;
    const emoIsCustom = !isNaN(Number(emoji.emoid));

    //prettier-ignore
    emoStr += '\n\t' + (idx + 1) + ' - ' +
    (emoIsCustom ? "\\:" + emoji.emoji + "\\: " : emoji.emoji) + ' - ' +
    (emoIsCustom ? (emoji.animated ? ' <a:' : ' <:') + emoji.emoji + ':' + emoji.emoid + '> - ' : '' ) +
    emoji.frequency;
  });

  const emojiEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Top 5 Emojis")
    .setDescription(emoStr)
    .setThumbnail("https://i.imgur.com/KMroCAv.png");

  await message.reply({ embeds: [emojiEmbed] });
};

export { cmdName, data, execute, featureKey };
