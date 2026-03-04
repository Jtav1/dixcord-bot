import { clientId } from "../../configVars.js";

import {
  getLinkFixerResponse,
  getFortuneResponse,
} from "../../api/responses.js";
import {
  getTriggerList,
  getRandomResponseForTrigger,
} from "../../api/triggerResponses.js";

//******* UTILITIES FUNCTIONS ********//;
import { emojiDetector } from "./utilities/emojiDetector.js";
import { plusMinusMsg } from "./utilities/plusplus.js";

const name = "messageCreate";

/** Cached trigger strings from API; loaded on first message. */
let cachedTriggers = null;

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
        tmpWord.includes("https://x.com") ||
        tmpWord.includes("https://www.x.com") ||
        tmpWord.includes("https://twitter.com") ||
        tmpWord.includes("https://www.twitter.com") ||
        tmpWord.includes("instagram.com/") ||
        tmpWord.includes("www.instagram.com") ||
        tmpWord.includes("https://tiktok.com") ||
        tmpWord.includes("https://www.tiktok.com") ||
        tmpWord.includes("https://bsky.app")
      );
    });

    if (twitCheck.length > 0) {
      const twitFixReply = await getLinkFixerResponse(message.content ?? "");
      if (twitFixReply.length > 0) {
        response = twitFixReply;
      }
    }

    // Then, if message matches a trigger from the DB, get a random response for it
    if (cachedTriggers === null) {
      cachedTriggers = await getTriggerList();
    }
    const matchedTrigger = cachedTriggers.find((word) =>
      contentStripped.includes(word),
    );
    if (matchedTrigger) {
      response = await getRandomResponseForTrigger(matchedTrigger);
    }

    // If no response yet, check for fortune teller (mention + ?)
    if (
      !response &&
      contentStripped.startsWith(clientId) &&
      message.content.endsWith("?")
    ) {
      response = await getFortuneResponse();
    }

    // if a reply was generated, send it
    if (response.length > 0) {
      message.reply(response);
    }
  }
};

export const event = {
  name: name,
  execute: execute,
  once: false,
};
