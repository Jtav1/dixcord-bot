import { REST, Routes } from 'discord.js';
import { clientId, guildId, token } from './configVars.js';

const rest = new REST().setToken(token);

(async () => {
	try {
		// for guild-based commands
		await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
		console.log('Successfully deleted all guild commands.');
	} catch (error) {
		console.error(error);
	}
})();