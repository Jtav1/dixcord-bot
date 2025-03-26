import { SlashCommandBuilder } from 'discord.js';
import { getTotalScoreByString } from '../../middleware/plusplus.js';

const cmdName = 'plusplus-total';

const data = new SlashCommandBuilder()
  .setName('plusplus-total')
  .setDescription('The ++ score of a given word')
  .addStringOption((option) => 
    option.setName('word')
      .setDescription('The word to check')
      .setRequired(false)
  ).addUserOption((option) => 
    option.setName('user')
      .setDescription('The user to check')
      .setRequired(false)
  );

const execute = async (interaction) => {
  const word = interaction.options.getString('word') || null;
  const user = interaction.options.getUser('user') || null;
  
  let totalWordScore = word ? await getTotalScoreByString(word, "word") : null;
  let totalUserScore = user ? await getTotalScoreByString(user.id, "user") : null;

  console.log(totalWordScore);
  console.log(totalUserScore);

  let outStr = "";

  if(word && !user){
    outStr += "Total score for " + word + " is " + totalWordScore[0].total;
  } else if(user && !word){
    outStr += "Total score for " + "<@" + user.id + "> is " + totalUserScore[0].total;
  } else if(user && word){
    outStr += "Wow two at once. Score for " + word + " is " + totalWordScore[0].total + " and score for " + "<@" + user.id + "> is " + totalUserScore[0].total;
  } else {
    outStr += "You gotta give me something to work with here";
  }

  await interaction.reply({
    content: outStr,
    allowedMentions: {
      users: [],
    },
  });
};

export { cmdName, data, execute };
