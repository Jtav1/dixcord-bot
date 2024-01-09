const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { log_filter_list_loc, filterWordArray } = require('../../configVars.js');
const fs = require('node:fs');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('filteradd')
		.setDescription('Add a word to the chat log filter')
    .addStringOption(option => 
      option
        .setName('keyword')
        .setDescription('word or phrase to add to the filter list')
        .setRequired(true)
        )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks)
    .setDMPermission(false),
	async execute(interaction) {
    const keyword = interaction.options.getString('keyword');
		

    if(filterWordArray.includes(keyword)) {
      await interaction.reply('"' + keyword + '" is already on the filter list.');
      return;
    }

    //add it to the list in memory now
    filterWordArray.push(keyword);

    //add it to the list for next time
    fs.appendFile(log_filter_list_loc, "\n"+keyword, async function(err) {
      if(err) await interaction.reply("ERROR adding keyword: " + keyword + " to the filter list. Tell Justin to add it manually.");
      else await interaction.reply('"' + keyword + '" added to the filter list.');
    })
	},
};
