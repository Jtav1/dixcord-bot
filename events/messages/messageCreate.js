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
import twitterFixer from './utilities/twitterFixer.js';
import takeALook from './utilities/takeALook.js';
import fortuneTeller from './utilities/fortuneTeller.js';

const name = 'messageCreate';


// emojiDetector 
//  logs instances of each emojis in the message
//  return: none/void
const emojiDetector = (rawMessage) => {
	const EMOJIREGEX = /((?<!\\)<:[^:]+:(\d+)>)|\p{Emoji_Presentation}|\p{Extended_Pictographic}/gmu;
	const emojiDetector = (str) => str.match(EMOJIREGEX);

	let emoAry = emojiDetector(rawMessage.content) || [];

	emoAry.forEach(emo => {
		if (emo.length > 0) dataLog.countEmoji(emo);
	});
}

const execute = (message) => {

	//******* INCOMING MESSAGE PROCESSING *******//

	let response = '';

	if (!message.author.bot && !(message.author.id === clientId)) {

		// check every message for emojis
		emojiDetector(message);

		// Strip incoming message for comparison		
		const contentStripped = message.content.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");

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