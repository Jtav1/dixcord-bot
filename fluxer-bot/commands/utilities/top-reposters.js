import { EmbedBuilder } from "@fluxerjs/builders";

import { getTopReposters } from "../../api/emojis.js";
import { getRepostEmoji } from "../../configStore.js";

const cmdName = "top-reposters";
const featureKey = "repost_detection_enabled";

const data = {
  description: "Top 5 worst reposters",
  usage: "top-reposters",
};

const execute = async (message) => {
  const top5 = await getTopReposters(5);

  // emoid only present when matched to a synced guild_emojis row; else fall back to raw text.
  const repostEmojiValue = getRepostEmoji();
  const repostEmojiDisplay = repostEmojiValue?.emoid
    ? `<:repost:${repostEmojiValue.emoid}>`
    : (repostEmojiValue?.emoji ?? "❓");

  let replyStr = "Top 5 users with the most " + repostEmojiDisplay + " accusations:\n\n";
  top5.forEach((userRow, idx) => {
    //prettier-ignore
    replyStr += '\n\t' + (idx + 1) + " - " + "<@" + userRow.userid + ">" + " - " + userRow.count + " accusations";
  });

  const repostEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Top 5 Reposters")
    .setDescription(replyStr)
    .setThumbnail("https://i.imgur.com/KMroCAv.png");

  await message.reply({ embeds: [repostEmbed] });
};

export { cmdName, data, execute, featureKey };
