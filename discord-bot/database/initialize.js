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

  // TODO: Delete user_repost_tracking table before next prod deployment
  const repostTable = "user_repost_tracking"; //Also found in: import.js
  const repostTableCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      repostTable +
      " (id int PRIMARY KEY AUTO_INCREMENT," +
      " userid VARCHAR(500) NOT NULL," +
      " msgid VARCHAR(500) NOT NULL," +
      " accuser VARCHAR(500) NOT NULL," +
      " timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, " +
      " CONSTRAINT unique_repost_accusation UNIQUE (userid, msgid, accuser))"
  );
  await execQuery(repostTableCreateQuery);

  // Removed
  // const keywordUsageTable = "user_keyword_tracking"; //Also found in: import.js
  // const keywordUsageTableQuery = mysql.format(
  //   "CREATE TABLE IF NOT EXISTS " +
  //     keywordUsageTable +
  //     " (id int PRIMARY KEY AUTO_INCREMENT," +
  //     " keyword VARCHAR(500) NOT NULL," +
  //     " userid VARCHAR(500) DEFAULT null," +
  //     " msgid VARCHAR(500) DEFAULT null," +
  //     " timestamp DATETIME DEFAULT null, " +
  //     " CONSTRAINT unique_keyword_tracking UNIQUE (keyword))"
  // );
  // await execQuery(keywordUsageTableQuery);

  const plusTable = "plusplus_tracking"; //Also found in: import.js
  const plusTableqQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
      plusTable +
      " (id int PRIMARY KEY AUTO_INCREMENT," +
      " type VARCHAR(10) NOT NULL," +
      " string VARCHAR(500) DEFAULT null," +
      " voter VARCHAR(500) DEFAULT null, " +
      " timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, " +
      " value VARCHAR(500) DEFAULT null)"
  );
  await execQuery(plusTableqQuery);

  //User Lookup Table
  const userTblName = "user_lookup"; //Also found in: import.js
  const userTblCreateQuery = mysql.format(
    "CREATE TABLE IF NOT EXISTS " +
    userTblName +
      " (userid VARCHAR(255) NOT NULL," +
      " username VARCHAR(255) NOT NULL," +
      " handle VARCHAR(255) NOT NULL," +
      " PRIMARY KEY (userid, username))"
  );
  await execQuery(userTblCreateQuery);

  console.log("db: table initialization complete");
};
