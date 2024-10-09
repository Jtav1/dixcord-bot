import {
  mysqlHost,
  mysqlPort,
  mysqlUser,
  mysqlPw,
  mysqlDb,
} from "../configVars.js";

import mysql from "mysql2";

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
    console.log("db: Connection established");

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
  con.query(configTblCreateQuery);
  console.log("db: Configuration table created");

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
  con.query(emojiTblCreateQuery);
  console.log("db: Emoji table tracking created");

  //Pinned Message Table
  const pinTblName = "pin_history";
  const pinTblCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      pinTblName +
      "  (msgid VARCHAR(255) PRIMARY KEY," +
      "  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)"
  );
  con.query(pinTblCreateQuery);
  console.log("db: Pinned message tracking table created");

  //TakeALook Responses Table
  const takeALookTableName = "take_a_look_responses"; //Also found in: import.js
  const taleALookTableCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      takeALookTableName +
      " (id int PRIMARY KEY AUTO_INCREMENT," +
      " link VARCHAR(255) UNIQUE," +
      " isdefault smallint DEFAULT 0," +
      " frequency int DEFAULT 0)"
  );

  con.query(taleALookTableCreateQuery);
  console.log("db: Take a look at this response table created");
};
