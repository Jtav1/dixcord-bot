import {
  logFile,
  filterWordArray,
  mysqlHost,
  mysqlPort,
  mysqlUser,
  mysqlPw,
  mysqlDb,
  isDev,
} from "../configVars.js";
import fs from "node:fs";

import mysql from "mysql2";

var con = mysql.createPool({
  host: mysqlHost,
  port: mysqlPort,
  user: mysqlUser,
  password: mysqlPw,
  database: mysqlDb,
});

con.on("connection", function (connection) {
  console.log("DB Connection established");

  connection.on("error", function (err) {
    console.error(new Date(), "MySQL error", err.code);
  });
  connection.on("close", function (err) {
    console.error(new Date(), "MySQL close", err);
  });
});

con.addListener("error", (err) => {
  console.log(err);
});

//async wrapper for running select queries
async function getResults(qry) {
  console.log(qry);

  try {
    const [rows] = await con.promise().query(qry);
    return rows; // Return the result
  } catch (e) {
    console.err(e);
    return [];
  }
}

const countEmoji = (emoji) => {
  let emoCleaned = emoji
    .replace("<a", "")
    .replace("<", "")
    .replace(">", "")
    .split(":")
    .slice(1);

  if (emoCleaned.length == 2) {
    const emoIncrementQry = mysql.format(
      "UPDATE " +
        emojiTblName +
        " SET frequency = frequency + 1 WHERE emoji = ? AND emoid = ?",
      [emoCleaned[0], emoCleaned[1]]
    );

    con.query(emoIncrementQry);
  }
};

const logPinnedMessage = (msgid) => {
  if (msgid) {
    const boolPreviouslyPinned =
      isMessageAlreadyPinned(msgid) > 0 ? true : false; // shouldnt 0 be falsy idk how js works im dumb

    if (!boolPreviouslyPinned) {
      const pinLogQry = mysql.format(
        "INSERT INTO " + pinTblName + "(msgid) VALUES (?)",
        [msgid]
      );
      con.query(pinLogQry);
      console.log("MESSAGE ID SHOULD HAVE BEEN ADDED TO DB WITH: ");
      console.log(pinLogQry);
    } else {
      console.log("DO NOT PIN ITS IN THERE ALREADY");
    }
  }
};

const isMessageAlreadyPinned = async (msgid) => {
  var query = con.format(
    "SELECT * FROM " + pinTblName + " WHERE msgid LIKE CONCAT('%' ? '%')",
    msgid
  );
  const results = await getResults(query);

  console.log("results length " + results.length);

  return results.length > 0;
};

// TODO test that this works with the getResults query moved out
const getTopEmoji = async (number) => {
  let res = [];

  var query = con.format(
    "SELECT emoji, frequency, emoid, animated FROM " +
      emojiTblName +
      " ORDER BY frequency DESC LIMIT ?",
    [number]
  );

  try {
    const results = await getResults(query);
    console.log(results);
    res = results;
  } catch (e) {
    console.err(e);
  }
  return res;
};

const cleanLog = (message) => {
  const userIdRegex = /<@\d+>/g;
  const groupIdRegex = /<@&\d+>/g;
  const addressRegex = /\d{1,5}\s{1}\w+\s{1}\w+\s\w+/g;
  const phoneNumRegex = /(\([0-9]{3}\)|[0-9]{3})( |-)[0-9]{3}-[0-9]{4}/g;
  const emailRegex = /[a-zA-Z0-9]+@[a-zA-Z0-9]+.[a-zA-Z0-9]+/g;
  const urlRegex = /(http:\/\/|https:\/\/)[^\s]+/g;

  const spaceRegex = /\s+/g;

  //todo add logfile encryption

  let logMsg = message.content
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

  let cleanMsg = msgAry.join(" ").replace(spaceRegex, " ").trim();

  if (cleanMsg.length > 0) {
    fs.appendFile(logFile, cleanMsg + "\n", (err) => {
      if (err) {
        console.log("Error writing to chatlog file " + logFile + ": " + err);
      }
    });
  }
};

export default {
  cleanLog,
  countEmoji,
  getTopEmoji,
  logPinnedMessage,
  isMessageAlreadyPinned,
};
