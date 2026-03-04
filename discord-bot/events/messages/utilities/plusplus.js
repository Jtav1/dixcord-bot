import {
  plusplus,
  minusminus,
  recordPlusMinusFromMessage,
} from "../../../database/plusplus.js";

/** Used by reaction handler only (user votes). */
export const doplus = async (string, typestr, voterid) => {
  if (typestr !== "user" || string === voterid) return;
  plusplus(string, typestr, voterid).catch((err) => {
    console.log("plusplus error", err);
  });
};

/** Used by reaction handler only (user votes). */
export const dominus = async (string, typestr, voterid) => {
  if (typestr !== "user" || string === voterid) return;
  minusminus(string, typestr, voterid).catch((err) => {
    console.log("minusminus error", err);
  });
};

/**
 * Pass message content to the API; the webapi parses word++/user++/-- and applies filter list.
 * No parsing in the bot.
 */
export const plusMinusMsg = async (rawMessage) => {
  await recordPlusMinusFromMessage(rawMessage.content, rawMessage.author?.id);
};
