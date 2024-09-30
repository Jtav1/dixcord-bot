import dataLog from '../../../logging/dataLog.js';

// emojiDetector 
//  logs instances of each emojis in the message
//  return: none/void
const emojiDetector = (rawMessage) => {
	const EMOJIREGEX = /((<|<a):?:\w+:?\d+>)|\p{Emoji_Presentation}|\p{Extended_Pictographic}/gmu;
	const emojiDetector = (str) => str.match(EMOJIREGEX);

	let emoAry = emojiDetector(rawMessage.content) || [];

	emoAry.forEach(emo => {
		if (emo.length > 0) dataLog.countEmoji(emo);
	});
}

export default emojiDetector;