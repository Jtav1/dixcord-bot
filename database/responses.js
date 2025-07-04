import { execQuery } from "./queryRunner.js";

import mysql from "mysql2";

export const getRareArray = async () => {
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

export const getCommonArray = async () => {
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

export const getAllTakeALookLinks = async () => {
  var query = mysql.format("SELECT * FROM take_a_look_responses");
  return await execQuery(query);
};

export const insertTakeALookLink = async (link, isdefault) => {
  const linkInsertQry = mysql.format(
    "INSERT IGNORE INTO take_a_look_responses (link, isdefault) VALUES (?, ?)",
    [link, isdefault]
  );

  return await execQuery(linkInsertQry);
};

export const incrementTakeALookLink = async (link) => {
  const incrementQuery = mysql.format(
    "UPDATE take_a_look_responses SET frequency = frequency + 1 WHERE id = ?",
    [link.id]
  );

  return await execQuery(incrementQuery);
};

export const getAllFortunes = async () => {
  var query = mysql.format("SELECT * FROM eight_ball_responses");
  return await execQuery(query);
};

export const insertFortune = async (text, sentiment) => {
  const fortuneInsertQry = mysql.format(
    "INSERT IGNORE INTO eight_ball_responses (resoponse_string, sentiment) VALUES (?, ?)",
    [text, sentiment]
  );

  return await execQuery(fortuneInsertQry);
};

export const incrementFortune = async (fortune) => {
  const incrementQuery = mysql.format(
    "UPDATE eight_ball_responses SET frequency = frequency + 1 WHERE id = ?",
    [fortune.id]
  );

  return await execQuery(incrementQuery);
};
