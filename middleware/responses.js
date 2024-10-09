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
  try {
    const [rows] = await con.promise().query(qry);
    return rows; // Return the result
  } catch (e) {
    console.err(e);
    return [];
  }
}

const getRareArray = async () => {
  var query = con.format(
    "SELECT link FROM take_a_look_responses WHERE isdefault = 0"
  );
  const results = await getResults(query);

  //map this to an array of strings
  const tempArray = results.map((row) => {
    return row.link;
  });

  return tempArray;
};

const getCommonArray = async () => {
  var query = con.format(
    "SELECT link FROM take_a_look_responses WHERE isdefault = 1"
  );
  const results = await getResults(query);

  //map this to an array of strings
  const tempArray = results.map((row) => {
    return row.link;
  });

  return tempArray;
};

const getAllTakeALookLinks = async () => {
  const tmpArray = [];

  var query = con.format("SELECT * FROM take_a_look_responses");
  const results = await getResults(query);

  return results;
};

const insertTakeALookLink = async (link, isdefault) => {
  const linkInsertQry = mysql.format(
    "INSERT IGNORE INTO take_a_look_responses (link, isdefault) VALUES (?, ?)",
    [link, isdefault]
  );

  con
    .query(linkInsertQry)
    .then(() => {
      return true;
    })
    .catch((err) => {
      return false;
    });
};

const incrementTakeALookLink = async (link) => {
  const linkInsertQry = mysql.format(
    "UPDATE take_a_look_responses SET frequency = frequency + 1 WHERE link = ?",
    [link]
  );

  //TODO figure out how to return success/failure here
  con.query(linkInsertQry);
};

export {
  getRareArray,
  getCommonArray,
  getAllTakeALookLinks,
  insertTakeALookLink,
  incrementTakeALookLink,
};
