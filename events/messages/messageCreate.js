import { 
	clientId, 
	defaultArray, 
	rareArray, 
	rareFrequency, 
	positiveArray, 
	negativeArray,
	neutralArray, 
	twitterFixEnabled 
} from '../../configVars.js';

import dataLog from '../../logging/dataLog.js';

//******* RESPONSE FUNCTIONS *******//
import twitterFixer from './responses/twitterFixer.js';
import takeALook from './responses/takeALook.js';
import fortuneTeller from './responses/fortuneTeller.js';

//******* UTILITIES FUNCTIONS ********//;
import emojiDetector from './utilities/emojiDetector.js'



const name = 'messageCreate';

const execute = (message) => {

	//******* INCOMING MESSAGE PROCESSING *******//

	let response = '';

	if (!message.author.bot && !(message.author.id === clientId)) {

		// check every message for emojis
		emojiDetector(message);

		// Strip incoming message for comparison		
		const contentStripped = message.content.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");

		// if(contentStripped.includes("emojis")){
		// 	console.log("okay getting top emojis");
		// 	console.log(dataLog.getTopEmoji());

		// }

		// If there's a twitter link to fix, do that
		if (twitterFixEnabled) {
			let twitFixReply = twitterFixer(message.content);
			if (twitFixReply.length > 0) {
				response = twitFixReply;
			}
		} 
		
		// Then, if there's a Take A Look OR fortune teller prompt, handle that
		if (contentStripped.includes("takealookatthis")) {
			response = takeALook(rareFrequency, defaultArray, rareArray);

			//if not, check if there is a fortune teller request to reply to
		} else if (contentStripped.startsWith(clientId) && message.content.endsWith("?")) {
			response = fortuneTeller(
				message.content.toLowerCase(), 
				clientId, 
				positiveArray, 
				negativeArray, 
				neutralArray
			);
		}

		// if a reply was generated, send it
		if (response.length > 0) {
			// console.log("<@" + message.author.username + '>: ' + message.cleanContent);
			message.reply(response);
		}

		// If it wasnt a dixbot keyword, log the message for later bot training purposes
		// dataLog.cleanLog pulls out all mentions of userID and a preset list of names
		
		dataLog.cleanLog(message);

	}
}

export const event = {
	name: name,
	execute: execute,
	once: false,
}