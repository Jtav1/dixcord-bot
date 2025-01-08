import { SlashCommandBuilder } from "discord.js";
import { getKeywordUsage, getAllKeywords } from "../../middleware/keywords.js";

import moment from "moment/moment.js";

const cmdName = "time-since-keyword";

const allKeywords = await getAllKeywords();
const keywordAry = allKeywords.map((kw) => kw.keyword.toLowerCase());

console.log(keywordAry);

const data = new SlashCommandBuilder()
  .setName("time-since-keyword")
  .setDescription("When was the keyword last used?")
  .addStringOption((option) =>
    option
      .setName("keyword")
      .setDescription("One of the following keywords: " + keywordAry.join(", "))
      .setRequired(true)
  );

const execute = async (interaction) => {
  const inputKeyword = interaction.options.getString("keyword");
  let replyContents = "";

  if (inputKeyword.toLowerCase() in keywordAry) {
    let lastUsage = getKeywordUsage(inputKeyword);

    if (lastUsage.timestamp != null) {
      // prettier-ignore
      replyContents = `Last ${inputKeyword} was posted by <@${lastUsage.userid}> ${moment(lastUsage.timestamp).fromNow()} here: <@${lastUsage.msgid}>`;
    } else {
      replyContents = `I haven't seen anyone say ${inputKeyword} yet.`;
    }
  } else {
    replyContents = `Invalid keyword ${inputKeyword} isnt in ${keywordAry}`;
  }

  await interaction.reply({
    content: replyContents,
    allowedMentions: {
      users: [],
    },
  });
};

export { cmdName, data, execute };
