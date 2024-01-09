const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./configVars.js');

const rest = new REST().setToken(token);

// ...

// for guild-based commands
rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] })
	.then(() => console.log('Successfully deleted all guild commands.'))
	.catch(console.error);