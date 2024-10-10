import {
  take_a_look_list_file_loc,
  positive_file_loc,
  negative_file_loc,
  neutral_file_loc,
} from "../configVars.js";

import { execQuery } from "./queryRunner.js";

import mysql from "mysql2";
import fs from "node:fs";

//let take_a_look_list_file_loc = "../data/take_a_look_list.txt";
// let positive_file_loc = "/data/positive.txt";
// let negative_file_loc = "/data/negative.txt";
// let neutral_file_loc = "/data/neutral.txt";
// let log_filter_list_loc = "/data/logfilterlist.txt";

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

  await execQuery(
    "DELETE FROM emoji_frequency WHERE frequency = 0 and type = 'emoji'"
  );

  const emoInsertQry = mysql.format(
    "INSERT INTO emoji_frequency (emoid, emoji, frequency, animated, type) VALUES ? ON DUPLICATE KEY UPDATE emoid=emoid",
    [emojiArray]
  );

  await execQuery(emoInsertQry);
  console.log("db: emoji import complete");
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

  await execQuery(linkInsertQry);
  console.log("db: take a look import complete");
};

//Import all of the "fortune" responses
export const importFortunes = async () => {
  let rows = [];

  const positiveFile = fs.readFileSync(positive_file_loc, "utf8");
  positiveFile.split(/\r?\n/).forEach((line) => {
    rows.push([line.trim(), "positive"]);
  });

  const negativeFile = fs.readFileSync(negative_file_loc, "utf8");
  negativeFile.split(/\r?\n/).forEach((line) => {
    rows.push([line.trim(), "negative"]);
  });

  const neutralFile = fs.readFileSync(neutral_file_loc, "utf8");
  neutralFile.split(/\r?\n/).forEach((line) => {
    rows.push([line.trim(), "neutral"]);
  });

  const linkInsertQry = mysql.format(
    "INSERT IGNORE INTO eight_ball_responses (response_string, sentiment) VALUES ?",
    [rows]
  );

  await execQuery(linkInsertQry);
  console.log("db: fortune import complete");
};
