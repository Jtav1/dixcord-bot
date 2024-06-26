const { SlashCommandBuilder } = require('discord.js');
const dataLog = require('../../Logging/dataLog.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('top-emojis')
		.setDescription('Top 5 Most Used Emojis in Dixcord'),
	async execute(interaction) {
        // let topAry = dataLog.getTopEmoji(5);

        // console.log(topAry);

        await interaction.reply('bing bong');

    }
};
