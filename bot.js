// Require the necessary discord.js classes
import { REST, Routes, Client, Collection, Events, GatewayIntentBits, Partials } from 'discord.js';
import { token, clientId, guildId } from './configVars.js';

import fs from 'node:fs';
import path from 'node:path';

import dataLog from './Logging/dataLog.js';

// Create a new client instance
const client = new Client({ 
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessageReactions,
	], 
	partials: [
		Partials.Message, 
		Partials.Channel, 
		Partials.Reaction
	],});

//Set up slash commands
//Docs: https://discordjs.guide/creating-your-bot/command-handling.html

client.commands = new Collection();

const foldersPath = path.join(import.meta.dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for(const folder of commandFolders) {
	const folderFullPath = path.join(foldersPath, folder);
	for (const file of fs.readdirSync(folderFullPath).filter(file => file.endsWith('.js'))){
		console.log("importing from " + folderFullPath + "/" + file);
		const { command } = await import(path.join(folderFullPath, file));
		

		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			console.log("adding command: " + command.test)
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

//Set up events
//https://discord.js.org/#/docs/main/main/class/Client List of Events to handle
const eventsPath = path.join(import.meta.dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);

	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// Register commands
client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

client.once(Events.ClientReady, readyClient => {

	console.log("Initializing emoji set");

	client.guilds.fetch(guildId)
		.then(guild => {
			guild.emojis.fetch()
				.then((result) => {
					dataLog.initializeEmojisList(result.map((r) => 
						({
							id: r.id,
							name: r.name,
							animated: r.animated,
							type: "emoji"
						})
					));
				})
				.catch(console.error)
		})
		.catch(console.error)
	
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);

});

// https://stackoverflow.com/questions/66793543/reaction-event-discord-js
client.on('messageReactionAdd', async (reaction, user) => {
	
	let reactStr = "<:" + reaction._emoji.name + ":" + reaction._emoji.id + ">";
	dataLog.countEmoji(reactStr);

});

// Login to Discord with your client's token
client.login(token);

