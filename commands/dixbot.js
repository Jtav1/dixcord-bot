const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('dixbot')
		.setDescription('Replies with Something TBD'),
	async execute(interaction) {
		await interaction.reply('I\'M SICK AND TIRED OF THEM PUTTING CHEMICALS IN THE WATER TO TURN THE FRIGGIN FROGS GAY!');
	},
};
