import { getAllConfigurations } from "../../../middleware/configurations.js";

// twitterFixer(str)
//  reply with a vx twitter link if a non-vx twitter link is posted
//	note: will use the last link in the message
//  return: response (string)
export const twitterFixer = async (messageContents) => {
  // pull this at response time to get a fresh object

  const configurations = await getAllConfigurations();
  const twitterFixEnabled =
    configurations.filter(
      (config_entry) => config_entry.config === "twitter_fix_enabled"
    )[0].value === "true";

  let reply = "";

  if (
    twitterFixEnabled &&
    (messageContents.includes(" dd") ||
      messageContents.includes(" dixbot") ||
      messageContents.includes(" fix"))
  ) {
    const msgAry = messageContents.split(" ");

    msgAry.forEach((word) => {
      let cleanWord = word.replace(/[<>]/g, "");

      if (cleanWord.startsWith("https://x.com" || "https://www.x.com"  )) {
        reply =
          "fixed link: " +
          cleanWord.replace("x.com", "fixvx.com");
      } else if (cleanWord.startsWith("https://instagram.com" || "https://www.instagram.com")) {
        reply =
          "fixed link: " +
          cleanWord.replace("instagram.com", "ddinstagram.com");
      } else if (cleanWord.startsWith("https://tiktok.com" || "https://www.tiktok.com")) {
        reply =
          "fixed link: " +
          cleanWord.replace("tiktok.com", "vxtiktok.com");
      }
    });
  }

  return reply;
};
