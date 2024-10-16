import {
  take_a_look_list_file_loc,
  positive_file_loc,
  negative_file_loc,
  neutral_file_loc,
  log_filter_list_loc,
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
export const importConfigs = async () => {};

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

  if (linkArray.length < 2) linkArray = [linkArray];

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

  if (rows.length < 2) rows = [rows];

  const linkInsertQry = mysql.format(
    "INSERT IGNORE INTO eight_ball_responses (response_string, sentiment) VALUES ?",
    [rows]
  );

  await execQuery(linkInsertQry);
  console.log("db: fortune import complete");
};

//Import all of the "take a look at this" responses
export const importLogFilterKeywords = async () => {
  // if take a look at this file exists, parse it into an array, insert into db

  console.log(log_filter_list_loc);
  const file = fs.readFileSync(log_filter_list_loc, "utf8");
  let lines = file.split(/\r?\n/);

  let keywordArray = [];

  lines.forEach((line) => {
    keywordArray.push(line.toLowerCase().trim());
  });

  if (keywordArray.length < 2) keywordArray = [keywordArray];

  const keywordInsertQry = mysql.format(
    "INSERT IGNORE INTO log_filter_keywords (keyword) VALUES ?",
    [keywordArray]
  );

  await execQuery(keywordInsertQry);
  console.log("db: log filter keyword import complete");
};

export const importAll = async () => {
  await importConfigs();
  await importTakeALookList();
  await importFortunes();
  await importLogFilterKeywords();
};
