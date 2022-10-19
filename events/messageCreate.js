const images = {};

module.exports = {
	name: 'messageCreate',
	execute(message) {

		//******* Support functions *******//

		//too tired to figure this out so i stole it https://stackoverflow.com/questions/4652468/is-there-a-javascript-function-that-reduces-a-fraction dont ever say im not honest
		const reduce = (num, den) => {
			let gcd = (a, b) => {
				return b ? gcd(b, a%b) : a;
			}

			gcd = gcd(num, den);
			return [num/gcd, den/gcd];
		}



		//******* Response Functions *******//
			
		//TAKE A LOOK AT THIS
		const takeALook = () => {

			// eventually cache this lol
			// maybe write to redis if doesn't exist or exists and timestamp < x days old?
			let imgTbl = [];

			images.forEach((img) => {
				for(j=0; j<img.weight; j++){
					imgTbl.push(img);
				}
			});
				
			let imgObj = imgTbl[Math.floor(Math.random() * imgTbl.length)]

			let odds = (imgObj.weight / imgTbl.length) * 100;
			message.reply(imgObj.link);
		
			if(odds < 5){
				console.log(odds);
				let fraction = reduce(imgObj.weight, imgTbl.length);
				message.channel.send("ULTRA rare, odds: **" + fraction[0] + "** in **" + fraction[1] + "**");
			}
		}



		//******* Response Determination *******//

		if(!message.author.bot && !(message.author.id === clientId)){

			//List of all responses
			let commandDict = {
				'takealookatthis': takeALook,
			}

			//Strip incoming message for comparison
			let contentStripped = message.content.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
			
			//If the incoming message contains a response trigger phrase
			for(var key in commandDict){
				if(contentStripped.includes(key)){
					commandDict[key](); //run the response function
				}
			}
		}







	},
};