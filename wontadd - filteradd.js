//  not adding this command but saving the code for later when i do it on the web


// import fs from "node:fs";
// import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
// import { log_filter_list_loc, filterWordArray } from "../../configVars.js";

// const cmdName = "filterAdd";

// const data = new SlashCommandBuilder()
// 		.setName('filteradd')
// 		.setDescription('Add a word to the chat log filter')
//     .addStringOption(option => 
//       option
//         .setName('keyword')
//         .setDescription('word or phrase to add to the filter list')
//         .setRequired(true)
//         )
//     .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks)

// // const execute = async (interaction) => {
// //     const keyword = interaction.options.getString('keyword').toLowerCase();

// //     if(filterWordArray.includes(keyword)) {
// //       await interaction.reply('"' + keyword + '" is already on the filter list.');
// //       return;
// //     }

// //     //add it to the list in memory now
// //     filterWordArray.push(keyword);

// //     //add it to the list for next time
// //     fs.appendFile(log_filter_list_loc, keyword+"\n", async function(err) {
// //       if(err) await interaction.reply("ERROR adding keyword: " + keyword + " to the filter list. Tell Justin to add it manually.");
// //       else await interaction.reply('"' + keyword + '" added to the filter list.');
// //     })
// // 	};

// const execute = async

// export { cmdName, data, execute };