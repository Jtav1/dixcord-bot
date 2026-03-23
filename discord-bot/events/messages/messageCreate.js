import { clientId } from "../../configVars.js";

import {
  getLinkFixerResponse,
  getFortuneResponse,
} from "../../api/responses.js";
import {
  getTriggersList,
  getRandomResponseForTrigger,
} from "../../api/triggerResponses.js";
import { getLinkReplacementSourceHosts } from "../../api/linkReplacements.js";

//******* UTILITIES FUNCTIONS ********//;
import { emojiDetector } from "./utilities/emojiDetector.js";
import { plusMinusMsg } from "./utilities/plusplus.js";

const name = "messageCreate";

/** Cached triggers (with selection_mode) from API; loaded on first message. */
let cachedTriggers = null;

/** Cached link-replacement source hosts from API; loaded on first message. */
let cachedLinkHosts = null;

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
      .replace(/[^a-zA-Z0-9!]/g, "");

    // If there's a link to fix, do that (using source hosts from DB)
    if (cachedLinkHosts === null) {
      cachedLinkHosts = await getLinkReplacementSourceHosts();
    }
    const twitCheck = message.content.split(" ").filter((word) => {
      const tmpWord = word.replace(/[<>]/g, "");
      return cachedLinkHosts.some((host) => tmpWord.includes(host));
    });

    if (twitCheck.length > 0) {
      const twitFixReply = await getLinkFixerResponse(message.content ?? "");
      if (twitFixReply.length > 0) {
        response = twitFixReply;
      }
    }

    // Then, if message matches a trigger from the DB, get a random response for it
    if (cachedTriggers === null) {
      cachedTriggers = await getTriggersList();
    }
    const matchedTrigger = cachedTriggers.find((t) =>
      contentStripped.includes(t.trigger_string),
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
