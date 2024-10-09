import {
  mysqlHost,
  mysqlPort,
  mysqlUser,
  mysqlPw,
  mysqlDb,
  // defaultArray,
  // rareArray,
  // rareFrequency,
  // positiveArray,
  // negativeArray,
  // neutralArray,
  // logFile,
  // log_filter_list_loc,
  // filterWordArray,
  take_a_look_list_file_loc,
} from "../configVars.js";

import mysql from "mysql2";
import fs from "node:fs";

//let take_a_look_list_file_loc = "../data/take_a_look_list.txt";
// let positive_file_loc = "/data/positive.txt";
// let negative_file_loc = "/data/negative.txt";
// let neutral_file_loc = "/data/neutral.txt";
// let log_filter_list_loc = "/data/logfilterlist.txt";

var con = mysql.createPool({
  host: mysqlHost,
  port: mysqlPort,
  user: mysqlUser,
  password: mysqlPw,
  database: mysqlDb,
});

con.on("connection", function (connection) {
  console.log("db: Import, connection established");

  connection.on("error", function (err) {
    console.error(new Date(), "db: Import MySQL error", err.code);
  });
  connection.on("close", function (err) {
    console.error(new Date(), "db: Import MySQL close", err);
  });
});

con.addListener("error", (err) => {
  console.error(new Date(), "db: Import MySQL listener error", err);
});

//Import all configurations from flat files into the config table
//This should only matter the first time you run the bot after upgrading to ^1.6
export const importConfigs = async () => {};

//Import emojis into database by checking what the server has, clearing out all un-incremented emoji entries
//and then inserting all
export const importEmojiList = async (emojiObjectList) => {
  let emojiArray = [];

  emojiObjectList.forEach((e) => {
    emojiArray.push([`${e.id}`, `${e.name}`, 0, e.animated, `${e.type}`]);
  });

  con.query(
    "DELETE FROM emoji_frequency WHERE frequency = 0 and type = 'emoji'"
  );

  const emoInsertQry = mysql.format(
    "INSERT INTO emoji_frequency (emoid, emoji, frequency, animated, type) VALUES ? ON DUPLICATE KEY UPDATE emoid=emoid",
    [emojiArray]
  );

  con.query(emoInsertQry);
};

//Import all of the "take a look at this" responses
export const importTakeALookList = async () => {
  // if take a look at this file exists, parse it into an array, insert into db

  const file = fs.readFileSync(take_a_look_list_file_loc, "utf8");
  let lines = file.split(/\r?\n/);

  let linkArray = [];

  lines.forEach((line) => {
    if (line.startsWith("*")) {
      linkArray.push([line.replace(/[*]/g, "").trim(), 1]);
    } else {
      linkArray.push([line.trim(), 0]);
    }
  });

  const linkInsertQry = mysql.format(
    "INSERT IGNORE INTO take_a_look_responses (link, isdefault) VALUES ?",
    [linkArray]
  );

  con.query(linkInsertQry);
};

//Import all of the "fortune" responses
export const importFortunes = async () => {
  // if take a look at this file exists, parse it into an array, insert into db

  const file = fs.readFileSync(take_a_look_list_file_loc, "utf8");
  let lines = file.split(/\r?\n/);

  let linkArray = [];

  lines.forEach((line) => {
    if (line.startsWith("*")) {
      linkArray.push([line.replace(/[*]/g, "").trim(), 1]);
    } else {
      linkArray.push([line.trim(), 0]);
    }
  });

  const linkInsertQry = mysql.format(
    "INSERT IGNORE INTO take_a_look_responses (link, isdefault) VALUES ?",
    [linkArray]
  );

  con.query(linkInsertQry);
};
