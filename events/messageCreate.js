const { clientId, defaultArray, rareArray, rareFrequency, positiveArray, negativeArray, neutralArray } = require('../configVars.js');

// var Sentiment = require('sentiment');
// var sentiment = new Sentiment();

let limit = 0;
let lastReplyTimestamp = null;
let ms = (Math.random() * 60000) + 30000; // ANTI EXPLOIT TECHNOLOGY

module.exports =  {
	name: 'messageCreate',
	execute(message) {

		//******* RESPONSE FUNCTIONS *******//
			
		// takeALook()
		//	selects an image and sends a reply containing the link
		//	if the image has a sufficient rarity, also says that
		const takeALook = () => {

			console.log("Limit: " + limit);
			if(limit < 3){
				limit++
			} else if(limit >= 3){

				let nowTime = Date.now();

				console.log("elapsed ms: " + Math.floor((nowTime - lastReplyTimestamp)));

				if(Math.floor((nowTime - lastReplyTimestamp)) >= ms) {
					// If a third reply has occured previously to set a timestamp, and that timestamp is over ms time ago
					//its time to continue
					limit = 0;

				} else {
					limit++;
					(limit == 4) ? message.reply("No spam!") : null; // https://i.imgur.com/kAClxb0.png = spam picture url lol
					return;
				}
			} else {
				return;
			}

			lastReplyTimestamp = Date.now();
			let imgLink = "";

			//New calculation
			let diceRoll = Math.random();

			if(diceRoll <= rareFrequency){
				console.log("diceRoll of " + diceRoll + " is within rare frequency of " + rareFrequency + " - returning rare link.")
				imgLink = rareArray[rareArray.length * Math.random() | 0]
			} else {
				console.log("diceRoll of " + diceRoll + " is outside rare frequency of " + rareFrequency + " - returning default link.")
				imgLink = defaultArray[defaultArray.length * Math.random() | 0]
			}

			console.log("Sending message: " + imgLink);
			message.reply(imgLink);
		}


		// fortuneTeller()
		//	Randomly sends a fortune
		const fortuneTeller = (rawMessage) => {
			console.log("Fortune teller: ")
			const processedMessage = rawMessage.replace("<@" + clientId + ">", "")
			console.log(rawMessage + " => " + processedMessage);
			//var result = sentiment.analyze(processedMessage);

			const combinedResponses = positiveArray.concat(negativeArray, neutralArray);
			console.log(combinedResponses.length);
			message.reply(combinedResponses[Math.floor(Math.random() * combinedResponses.length)]);
		}

		//******* INCOMING MESSAGE PROCESSING *******//
			
		if(!message.author.bot && !(message.author.id === clientId)){
			
			// List of all response functions
			//let commandDict = {
			//	'takealookatthis': ,
			//	'dixbotfortune': fortuneTeller,
			//}

			// Strip incoming message for comparison		
			const contentStripped = message.content.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
			
			// If the incoming message contains a response trigger phrase
			if(contentStripped.includes("takealookatthis")){
				takeALook();
			} else if(contentStripped.startsWith(clientId) && message.content.endsWith("?")){
				fortuneTeller(message.content.toLowerCase());
			}
		}
	},
};