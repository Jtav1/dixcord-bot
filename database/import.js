import mysql from "mysql2";
// import fs from "node:fs";

import { dataDirectory, isDev } from "../configVars.js";
import { execQuery } from "./queryRunner.js";

// These were imported in 1.6, and are legacy. left here just in case.
// let take_a_look_list_file_loc = `${dataDirectory}/take_a_look_list.txt`;
// let positive_file_loc = `${dataDirectory}/positive.txt`;
// let negative_file_loc = `${dataDirectory}/negative.txt`;
// let neutral_file_loc = `${dataDirectory}/neutral.txt`;
// let log_filter_list_loc = `${dataDirectory}/logfilterlist.txt`;

//Import all configurations
export const importConfigs = async () => {
  //hardcoding these for default imported values

  const delay = Math.floor(Math.random() * 60000 + 60000);
  const pinThreshold = isDev ? 1 : 3;
  const pinChannelId = isDev ? "710671234471559228" : "915462110761349201";
  const announceChannelId = isDev ? "710671234471559228" : "911427650730487878";

  const configArray = [
    ["rare_frequency", 0.1],
    ["twitter_fix_enabled", "true"],
    ["pin_threshold", pinThreshold],
    ["pin_emoji", "\ud83d\udccc"],
    ["repost_emoji", "1072368151922233404"],
    ["announce_channel_id", announceChannelId],
    ["take_a_look_delay", delay],
    ["take_a_look_repost_limit", 2],
    ["pin_channel_id", pinChannelId],
  ];

  const configInsertQry = mysql.format(
    "INSERT IGNORE INTO configurations (config, value) VALUES ?",
    [configArray]
  );

  await execQuery(configInsertQry);
  console.log("db: configuration import complete");
};

//Import all of the "take a look at this" responses
// export const importTakeALookList = async () => {
//   // if take a look at this file exists, parse it into an array, insert into db

//   const file = fs.readFileSync(take_a_look_list_file_loc, "utf8");
//   let lines = file.split(/\r?\n/);

//   let linkArray = [];

//   lines.forEach((line) => {
//     if (line.startsWith("*")) {
//       linkArray.push([line.replace(/[*]/g, "").trim(), 1]);
//     } else {
//       linkArray.push([line.trim(), 0]);
//     }
//   });

//   if (linkArray.length < 2) linkArray = [linkArray];

//   const linkInsertQry = mysql.format(
//     "INSERT IGNORE INTO take_a_look_responses (link, isdefault) VALUES ?",
//     [linkArray]
//   );

//   await execQuery(linkInsertQry);
//   console.log("db: take a look import complete");
// };

//Import all of the "fortune" responses
// export const importFortunes = async () => {
//   let rows = [];

//   const positiveFile = fs.readFileSync(positive_file_loc, "utf8");
//   positiveFile.split(/\r?\n/).forEach((line) => {
//     rows.push([line.trim(), "positive"]);
//   });

//   const negativeFile = fs.readFileSync(negative_file_loc, "utf8");
//   negativeFile.split(/\r?\n/).forEach((line) => {
//     rows.push([line.trim(), "negative"]);
//   });

//   const neutralFile = fs.readFileSync(neutral_file_loc, "utf8");
//   neutralFile.split(/\r?\n/).forEach((line) => {
//     rows.push([line.trim(), "neutral"]);
//   });

//   if (rows.length < 2) rows = [rows];

//   const linkInsertQry = mysql.format(
//     "INSERT IGNORE INTO eight_ball_responses (response_string, sentiment) VALUES ?",
//     [rows]
//   );

//   await execQuery(linkInsertQry);
//   console.log("db: fortune import complete");
// };

//Import all of the "take a look at this" responses
// export const importLogFilterKeywords = async () => {
//   // if take a look at this file exists, parse it into an array, insert into db

//   const file = fs.readFileSync(log_filter_list_loc, "utf8");
//   let lines = file.split(/\r?\n/);

//   let keywordArray = [];

//   lines.forEach((line) => {
//     keywordArray.push([line.toLowerCase().trim()]);
//   });

//   //if (keywordArray.length < 2) keywordArray = [keywordArray];

//   const keywordInsertQry = mysql.format(
//     "INSERT IGNORE INTO log_filter_keywords (keyword) VALUES ?",
//     [keywordArray]
//   );

//   await execQuery(keywordInsertQry);
//   console.log("db: log filter keyword import complete");
// };

export const importAll = async () => {
  await importConfigs();
  // await importTakeALookList();
  // await importFortunes();
  // await importLogFilterKeywords();
};
