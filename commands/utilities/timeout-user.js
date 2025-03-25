import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { timeoutUser } from '../../events/messages/utilities/timeout.js';

const cmdName = 'curseofra';

const data = new SlashCommandBuilder()
    .setName('curseofra')
    .setDescription('Timeout a user for exactly 10 minutes')
    .addUserOption(option => 
        option.setName('user')
            .setDescription('The user to timeout')
            .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

async function execute(interaction) {

    // Check if the user has permissions to timeout members
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {

        await interaction.reply({
            content: 'You do not have permission to timeout members.',
            ephemeral: true
        });
    }

    const targetUser = interaction.options.getUser('user');
    
    timeoutUser(targetUser.id, interaction.guild).then((result) => {
      interaction.reply('CURSE OF RA 𓀀 𓀁 𓀂 𓀃 𓀄 𓀅 𓀆 𓀇 𓀈 𓀉 𓀊 𓀋 𓀌 𓀍 𓀎 𓀏 𓀐 𓀑 𓀒 𓀓 ... ' + result);
    }).catch((error) => {
      console.log('Something broke lol');
      console.log(error);
    });
   
}

export { cmdName, data, execute };
