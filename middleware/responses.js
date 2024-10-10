import { logFile, filterWordArray, isDev } from "../configVars.js";

import { execQuery } from "../database/queryRunner.js";

import mysql from "mysql2";

const getRareArray = async () => {
  var query = mysql.format(
    "SELECT link FROM take_a_look_responses WHERE isdefault = 0"
  );
  const results = await execQuery(query);

  //map this to an array of strings
  const tempArray = results.map((row) => {
    return row.link;
  });

  return tempArray;
};

const getCommonArray = async () => {
  var query = mysql.format(
    "SELECT link FROM take_a_look_responses WHERE isdefault = 1"
  );
  const results = await execQuery(query);

  //map this to an array of strings
  const tempArray = results.map((row) => {
    return row.link;
  });

  return tempArray;
};

const getAllTakeALookLinks = async () => {
  var query = mysql.format("SELECT * FROM take_a_look_responses");
  return await execQuery(query);
};

const insertTakeALookLink = async (link, isdefault) => {
  const linkInsertQry = mysql.format(
    "INSERT IGNORE INTO take_a_look_responses (link, isdefault) VALUES (?, ?)",
    [link, isdefault]
  );

  return await execQuery(linkInsertQry);
};

const incrementTakeALookLink = async (link) => {
  const incrementQuery = mysql.format(
    "UPDATE take_a_look_responses SET frequency = frequency + 1 WHERE link = ?",
    [link]
  );

  return await execQuery(incrementQuery);
};

const getAllFortunes = async () => {
  var query = mysql.format("SELECT * FROM eight_ball_responses");
  return await execQuery(query);
};

const insertFortune = async (text, sentiment) => {
  const fortuneInsertQry = mysql.format(
    "INSERT IGNORE INTO eight_ball_responses (resoponse_string, sentiment) VALUES (?, ?)",
    [text, sentiment]
  );

  return await execQuery(fortuneInsertQry);
};

const incrementFortune = async (text, sentiment) => {
  const incrementQuery = mysql.format(
    "UPDATE eight_ball_responses SET frequency = frequency + 1 WHERE resoponse_string = ? AND sentiment = ?",
    [text, sentiment]
  );

  return await execQuery(incrementQuery);
};

export {
  getRareArray,
  getCommonArray,
  getAllTakeALookLinks,
  insertTakeALookLink,
  incrementTakeALookLink,
  getAllFortunes,
  insertFortune,
  incrementFortune,
};
