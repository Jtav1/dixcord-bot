import { SlashCommandBuilder } from 'discord.js';
import { getTotalScoreByString, getVotesById } from '../../database/plusplus.js';

const cmdName = 'plusplus-voter-frequency';

const data = new SlashCommandBuilder()
  .setName('plusplus-voter-frequency')
  .setDescription('The number of times a user has +/-d something')
  .addUserOption((option) => 
    option.setName('user')
      .setDescription('The user to check')
      .setRequired(true)
  );

const execute = async (interaction) => {
  const user = interaction.options.getUser('user');  
  let totalVotes = await getVotesById(user.id);

  await interaction.reply({
    content: `User <@${user.id}> has ${totalVotes[0].total} plusplus votes`,
    allowedMentions: {
      users: [],
    },
  });
};

export { cmdName, data, execute };
