const { clientId, defaultArray, rareArray, rareFrequency } = require('../configVars.js');

let limit = 0;
let ms = 25000;
let thirdReplyTimestamp = null;

module.exports =  {
	name: 'messageCreate',
	execute(message) {

		//******* RESPONSE FUNCTIONS *******//
			
		// takeALook()
		//	selects an image and sends a reply containing the link
		//	if the image has a sufficient rarity, also says that
		const takeALook = () => {

			let nowTime = Date.now();
			if(thirdReplyTimestamp && (Math.floor((nowTime - thirdReplyTimestamp)) >= ms)) {
				
				// If a third reply has occured previously to set a timestamp, and that timestamp is over 10 seconds ago
				console.log("difference: " + Math.floor((nowTime - thirdReplyTimestamp)));
				
				//its time to continue
				thirdReplyTimestamp = null;
				limit = 0;
			}


			if(limit < 2){
				limit++
			} else {
				if(!thirdReplyTimestamp)	{
					message.reply("https://i.imgur.com/kAClxb0.png"); // https://i.imgur.com/kAClxb0.png = spam picture url lol
					thirdReplyTimestamp = Date.now();
				}
				
				return;
			}

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

		const fortuneTeller = () => {
			console.log("Sending fortune: " + "fortune here lol");
			message.reply("oop you found me!");
		}

		//******* INCOMING MESSAGE PROCESSING *******//
			
		if(!message.author.bot && !(message.author.id === clientId)){
			
			// List of all response functions
			//let commandDict = {
			//	'takealookatthis': ,
			//	'dixbotfortune': fortuneTeller,
			//}

			// Strip incoming message for comparison		
			let contentStripped = message.content.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
			
			// If the incoming message contains a response trigger phrase
			if(contentStripped.includes("takealookatthis")){
				takeALook();
			} else if(contentStripped.startsWith(clientId) && message.content.endsWith("?")){
				//fortuneTeller();
			}
		}
	},
};