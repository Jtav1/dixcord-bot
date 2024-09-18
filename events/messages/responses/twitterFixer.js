// twitterFixer(str)
//  reply with a vx twitter link if a non-vx twitter link is posted
//	note: will use the last link in the message
//  return: response (string)
const twitterFixer = (messageContents) => {
	
	const msgAry = messageContents.split(' ');
	let reply = '';

	msgAry.forEach(word => {

		let cleanWord = word.replace(/[<>]/g, '');

		if(cleanWord.startsWith('https://x.com')){
			if(messageContents.includes('dd') ||
				messageContents.includes('dixbot') ||
				messageContents.includes('fix')){

				reply = ("fixed link: " + cleanWord.replace('https://x.com/', 'https://vxtwitter.com/'));
			}
		}

	});

	return reply;
}

export default twitterFixer;