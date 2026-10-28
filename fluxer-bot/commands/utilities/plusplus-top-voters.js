import { EmbedBuilder } from "@fluxerjs/builders";

import { getTopVoters } from "../../api/plusplus.js";

const cmdName = "plusplus-top-voters";
const featureKey = "plusplus_enabled";

const data = {
  description: "The top 3 plusplus voters",
  usage: "plusplus-top-voters",
};

const execute = async (message) => {
  const topVoters = await getTopVoters(3);

  let outStr = "Top 3 plusplus voters:\n\n";
  topVoters.forEach((voter, idx) => {
    outStr += `\n\t${idx + 1} - <@${voter.voter}> has cast ${voter.total} votes`;
  });

  const voterEmbed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Top 3 plusplus voters")
    .setDescription(outStr)
    .setThumbnail("https://i.imgur.com/KMroCAv.png");

  await message.reply({ embeds: [voterEmbed] });
};

export { cmdName, data, execute, featureKey };
