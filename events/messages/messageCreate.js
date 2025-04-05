import { clientId } from "../../configVars.js";
import { cleanLog } from "../../logging/dataLog.js";

//******* RESPONSE FUNCTIONS *******//
import { twitterFixer } from "./responses/twitterFixer.js";
import { takeALook } from "./responses/takeALook.js";
import { fortuneTeller } from "./responses/fortuneTeller.js";

//******* UTILITIES FUNCTIONS ********//;
import { emojiDetector } from "./utilities/emojiDetector.js";
import { plusMinusMsg } from "./utilities/plusplus.js";

const name = "messageCreate";

const execute = async (message) => {
  //******* INCOMING MESSAGE PROCESSING *******//

  let response = "";

  if (!message.author.bot && !(message.author.id === clientId)) {
    // check every message for emojis
    await emojiDetector(message);
    await plusMinusMsg(message);

    // Removed
    //check every message for keywords
    // keywordDetector(message);

    // Strip incoming message for comparison
    const contentStripped = message.content
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, "");

    // If there's a twitter link to fix, do that
    const twitCheck = message.content.split(" ").filter((word) => {
      const tmpWord = word.replace(/[<>]/g, "");
      return (
        tmpWord.includes("https://x.com") || tmpWord.includes("https://www.x.com") ||
        tmpWord.includes("https://twitter.com") || tmpWord.includes("https://www.twitter.com") ||
        tmpWord.includes("https://instagram.com") || tmpWord.includes("https://www.instagram.com") ||
        tmpWord.includes("https://tiktok.com") || tmpWord.includes("https://www.tiktok.com") ||
        tmpWord.includes("https://bsky.app")
      )
    });

    if (twitCheck.length > 0) {
      const twitFixReply = await twitterFixer(message.content);
      if (twitFixReply.length > 0) {
        response = twitFixReply;
      }
    }

    // Then, if there's a Take A Look OR fortune teller prompt, handle that
    if (contentStripped.includes("takealookatthis") || contentStripped.includes("takenalookatthis") || contentStripped.includes("tookalookatthis") || contentStripped.includes("takingalookatthis")) {
      response = await takeALook();

      //if not, check if there is a fortune teller request to reply to
    } else if (
      contentStripped.startsWith(clientId) &&
      message.content.endsWith("?")
    ) {
      response = fortuneTeller(message.content.toLowerCase(), clientId);
    }

    // if a reply was generated, send it
    if (response.length > 0) {
      message.reply(response);
    }

    // If it wasnt a dixbot keyword, log the message for later bot training purposes
    // dataLog cleanLog pulls out all mentions of userID and a preset list of names

    await cleanLog(message);
  }
};

export const event = {
  name: name,
  execute: execute,
  once: false,
};
