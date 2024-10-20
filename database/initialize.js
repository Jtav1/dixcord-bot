import mysql from "mysql2";
import { execQuery } from "./queryRunner.js";

//Initialize DB by setting up all required tables, etc
export const initializeDatabase = async () => {
  //Configuration table
  const configTblName = "configurations";
  const configTblCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      configTblName +
      " (config VARCHAR(255) PRIMARY KEY," +
      " value VARCHAR(255))"
  );
  await execQuery(configTblCreateQuery);

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
  await execQuery(emojiTblCreateQuery);

  //Pinned Message Table
  const pinTblName = "pin_history";
  const pinTblCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      pinTblName +
      "  (msgid VARCHAR(255) PRIMARY KEY," +
      "  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)"
  );
  await execQuery(pinTblCreateQuery);

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
  await execQuery(takeALookTableCreateQuery);

  //Fortune responses table
  const eightBallTableName = "eight_ball_responses"; //Also found in: import.js
  const eightBallTableCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      eightBallTableName +
      " (id int PRIMARY KEY AUTO_INCREMENT," +
      " response_string VARCHAR(500) NOT NULL," +
      " sentiment ENUM('positive', 'negative', 'neutral') NOT NULL," +
      " frequency int DEFAULT 0," +
      " UNIQUE KEY `unique_response` (`response_string`, `sentiment`))"
  );
  await execQuery(eightBallTableCreateQuery);

  //Log filter keywords table
  const logFilterTableName = "log_filter_keywords";
  const logFilterTableCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      logFilterTableName +
      " (id int PRIMARY KEY AUTO_INCREMENT," +
      " keyword VARCHAR(255) UNIQUE)"
  );
  await execQuery(logFilterTableCreateQuery);

  //Tracking user usage of emojis table
  //  note: not going to alter the emoji frequency table to cascade delete because it should only
  //  delete unused emojis and an unused emoji should not be referenced by this table
  const userEmojiTableName = "user_emoji_tracking"; //Also found in: import.js
  const userEmojiTableCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      userEmojiTableName +
      " (id int PRIMARY KEY AUTO_INCREMENT," +
      " userid VARCHAR(500) NOT NULL," +
      " emoid VARCHAR(255) NOT NULL REFERENCES " +
      emojiTblName +
      " (emoid)," +
      " frequency int DEFAULT 1," +
      " CONSTRAINT unique_user_emoji UNIQUE (userid, emoid))"
  );
  await execQuery(userEmojiTableCreateQuery);
};
