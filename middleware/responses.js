import { logFile, filterWordArray, isDev } from "../configVars.js";

import { execQuery } from "../database/queryRunner.js";

import mysql from "mysql2";

const getRareArray = async () => {
  var query = mysql.format(
    "SELECT link FROM take_a_look_responses WHERE isdefault = 0"
  );
  const results = await execQuery(query);

  console.log("------ rare array ------");
  console.log(results);

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

  console.log("------ common array ------");
  console.log(results);

  //map this to an array of strings
  const tempArray = results.map((row) => {
    return row.link;
  });

  return tempArray;
};

const getAllTakeALookLinks = async () => {
  const tmpArray = [];

  var getAllQry = mysql.format("SELECT * FROM take_a_look_responses");

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
  const linkInsertQry = mysql.format(
    "UPDATE take_a_look_responses SET frequency = frequency + 1 WHERE link = ?",
    [link]
  );

  return await execQuery(linkInsertQry);
};

export {
  getRareArray,
  getCommonArray,
  getAllTakeALookLinks,
  insertTakeALookLink,
  incrementTakeALookLink,
};
