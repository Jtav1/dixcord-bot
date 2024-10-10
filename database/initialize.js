import {
  mysqlHost,
  mysqlPort,
  mysqlUser,
  mysqlPw,
  mysqlDb,
} from "../configVars.js";

import mysql from "mysql2";

const execQuery = (con, query) => {
  con
    .promise()
    .query(query)
    .then((result) => {
      console.log("db: query successful: " + query.substring(0, 50) + "...");
    })
    .catch((err) => {
      console.log("db: table create query error", err);
      console.log(query);
    });
};

//Initialize DB by setting up all required tables, etc
export const initializeDatabase = async () => {
  var con = mysql.createPool({
    host: mysqlHost,
    port: mysqlPort,
    user: mysqlUser,
    password: mysqlPw,
    database: mysqlDb,
  });

  con.on("connection", function (connection) {
    connection.on("error", function (err) {
      console.error(new Date(), "db: MySQL error", err.code);
    });
    connection.on("close", function (err) {
      console.error(new Date(), "db: MySQL close", err);
    });
  });

  con.addListener("error", (err) => {
    console.error(new Date(), "db: MySQL listener error", err);
  });

  //Configuration table
  const configTblName = "configurations";
  const configTblCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      configTblName +
      " (config VARCHAR(255) PRIMARY KEY," +
      " value VARCHAR(255))"
  );
  execQuery(con, configTblCreateQuery);

  //Emoji Tracking Table
  const emojiTblName = "emoji_frequency"; //Also found in: import.js
  const emojiTblCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      emojiTblName +
      " (emoid VARCHAR(255) NOT NULL," +
      " emoji VARCHAR(255) NOT NULL," +
      " frequency INT NOT NULL," +
      " animated BOOLEAN," +
      " type VARCHAR(50) NOT NULL," +
      " PRIMARY KEY (emoid))"
  );
  execQuery(con, emojiTblCreateQuery);

  //Pinned Message Table
  const pinTblName = "pin_history";
  const pinTblCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      pinTblName +
      "  (msgid VARCHAR(255) PRIMARY KEY," +
      "  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)"
  );
  execQuery(con, pinTblCreateQuery);

  //TakeALook Responses Table
  const takeALookTableName = "take_a_look_responses"; //Also found in: import.js
  const takeALookTableCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      takeALookTableName +
      " (id int PRIMARY KEY AUTO_INCREMENT," +
      " link VARCHAR(255) UNIQUE," +
      " isdefault smallint DEFAULT 0," +
      " frequency int DEFAULT 0)"
  );
  execQuery(con, takeALookTableCreateQuery);

  //TakeALook Responses Table
  const eightBallTableName = "eight_ball_responses"; //Also found in: import.js
  const eightBallTableCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      eightBallTableName +
      " (id int PRIMARY KEY AUTO_INCREMENT," +
      " response_string VARCHAR(500) NOT NULL," +
      " sentiment ENUM('positive', 'negative', 'neutral')," +
      " frequency int DEFAULT 0)"
  );
  execQuery(con, eightBallTableCreateQuery);
};
