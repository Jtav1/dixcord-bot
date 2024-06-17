// Require the necessary discord.js classes
const { REST, Routes, Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token, clientId, guildId } = require('./configVars.js');

const fs = require('node:fs');
const path = require('node:path');

const dataLog = require('./Logging/dataLog.js');

// Create a new client instance
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
] });

//Set up slash commands
//Docs: https://discordjs.guide/creating-your-bot/command-handling.html

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath); // grab all folders

// grab all commands in all folders
for (const folder of commandFolders) {

	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);

		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

//Set up events
//https://discord.js.org/#/docs/main/main/class/Client List of Events to handle
const eventsPath = path.join(__dirname, 'events');
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
					let emojiDoubleArray = [];

					//JUSTIN TODO: change this to be an array of objects
					// so that you can easily use them to clear out deleted emojis from the database
					// that may be gone but have a non-zero number of uses

					console.log(result);

					result.forEach((e) => {
						emojiDoubleArray.push([e.name, e.id]);
					})

					console.log(emojiDoubleArray);
					dataLog.initializeEmojisList(emojiDoubleArray);
				})
				.catch(console.error)
		})
		.catch(console.error)
	
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);

});

// Login to Discord with your client's token
client.login(token);
