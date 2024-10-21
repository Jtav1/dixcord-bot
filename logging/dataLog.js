import { dataDirectory, isDev } from "../configVars.js";
import { execQuery } from "../database/queryRunner.js";
import { getAllLogFilterKeywords } from "../middleware/filters.js";

import fs from "fs";
import mysql from "mysql2";

let filterWordArray = await getAllLogFilterKeywords();
filterWordArray = filterWordArray.map((w) => {
  return w.keyword;
});

export const logPinnedMessage = (msgid) => {
  if (msgid) {
    const boolPreviouslyPinned =
      isMessageAlreadyPinned(msgid) > 0 ? true : false; // shouldnt 0 be falsy idk how js works im dumb

    if (!boolPreviouslyPinned) {
      const pinLogQry = mysql.format(
        "INSERT INTO pin_history (msgid) VALUES (?)",
        [msgid]
      );
      execQuery(pinLogQry);
    } else {
    }
  }
};

export const isMessageAlreadyPinned = async (msgid) => {
  var query = mysql.format(
    "SELECT * FROM pin_history WHERE msgid LIKE CONCAT('%' ? '%')",
    msgid
  );
  const results = await execQuery(query);

  return results.length > 0;
};

export const cleanLog = async (message) => {
  const userIdRegex = /<@\d+>/g;
  const groupIdRegex = /<@&\d+>/g;
  const addressRegex = /\d{1,5}\s{1}\w+\s{1}\w+\s\w+/g;
  const phoneNumRegex = /(\([0-9]{3}\)|[0-9]{3})( |-)[0-9]{3}-[0-9]{4}/g;
  const emailRegex = /[a-zA-Z0-9]+@[a-zA-Z0-9]+.[a-zA-Z0-9]+/g;
  const urlRegex = /(http:\/\/|https:\/\/)[^\s]+/g;

  const spaceRegex = /\s+/g;

  //message.channelId
  //todo add logfile encryption
  //todo multiple files one for each channel id

  const channelLogfile =
    dataDirectory + "/" + message.channelId + "_cleanlog.txt";

  const logMsg = message.content
    .replace(userIdRegex, "")
    .replace(groupIdRegex, "")
    .replace(phoneNumRegex, "")
    .replace(emailRegex, "")
    .replace(urlRegex, "")
    .replace(addressRegex, "");

  let tmpAry = logMsg.split(" ");

  let msgAry = tmpAry.filter((word) => {
    return !filterWordArray.includes(word);
  });

  const cleanMsg = msgAry.join(" ").replace(spaceRegex, " ").trim();

  if (cleanMsg.length > 0) {
    if (isDev) {
      // console.log("DEV Chatlog entry: " + cleanMsg);
    } else {
      fs.appendFile(channelLogfile, cleanMsg + "\n", "utf8", (err) => {
        if (err) {
          console.log(
            "log: error writing to chatlog file " + channelLogfile + ": " + err
          );
        } else {
          console.log("log: wrote to log file " + channelLogfile);
        }
      });
    }
  }
};
