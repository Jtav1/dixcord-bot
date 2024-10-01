import { logFile, filterWordArray, mysqlHost, mysqlPort, mysqlUser, mysqlPw, mysqlDb, isDev } from '../configVars.js';
import fs from 'node:fs';

import mysql from 'mysql2';

var con = mysql.createPool(
  {
    host: mysqlHost,
    port: mysqlPort,
    user: mysqlUser,
    password: mysqlPw,
    database: mysqlDb
  }
);

con.on('connection', function (connection) {
  console.log('DB Connection established');

  connection.on('error', function (err) {
    console.error(new Date(), 'MySQL error', err.code);
  });
  connection.on('close', function (err) {
    console.error(new Date(), 'MySQL close', err);
  });
});


con.addListener('error', (err) => {
  console.log(err);
});

const emojiTblName = (isDev ? "dev_emoji_frequency" : "emoji_frequency");

const emojiTblCreateQuery = mysql.format(
  "CREATE TABLE IF NOT EXISTS " + emojiTblName +
  " (emoid VARCHAR(255) NOT NULL, " +
  "emoji VARCHAR(255) NOT NULL, " +
  "frequency INT NOT NULL, " +
  "animated BOOLEAN, " +
  "type VARCHAR(50) NOT NULL, " +
  "PRIMARY KEY (emoid))");

con.query(emojiTblCreateQuery);
console.log('-- Emoji table tracking created');

const pinTblName = (isDev ? "dev_pin_history" : "pin_history");

const pinTblCreateQuery = mysql.format(
  "CREATE TABLE IF NOT EXISTS " + pinTblName +
  "  (msgid VARCHAR(255) PRIMARY KEY," +
  "  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)");

con.query(pinTblCreateQuery);
console.log('-- Pinned message tracking table created');

//async wrapper for running select queries
async function getResults(qry) {

  try {
    const [rows] = await con.promise().query(qry);
  } catch (e){
    console.err(e);
  }

  return rows;  // Return the result
}

const initializeEmojisList = (emojiObjectList) => {
  let emojiArray = [];

  emojiObjectList.forEach((e) => {
    emojiArray.push(([`${e.id}`, `${e.name}`, 0, e.animated, `${e.type}`]));
  });

  con.query("DELETE FROM " + emojiTblName + " WHERE frequency = 0 and type = 'emoji'");

  const emoInsertQry = mysql.format(
    "INSERT INTO " + emojiTblName + " (emoid, emoji, frequency, animated, type) VALUES ? ON DUPLICATE KEY UPDATE emoid=emoid",
    [emojiArray]
  );

  con.query(emoInsertQry);
}


const countEmoji = (emoji) => {
  let emoCleaned = emoji.replace("<a", "").replace("<", "").replace(">", "").split(":").slice(1);

  if (emoCleaned.length == 2) {
    const emoIncrementQry = mysql.format(
      "UPDATE " + emojiTblName + " SET frequency = frequency + 1 WHERE emoji = ? AND emoid = ?",
      [emoCleaned[0], emoCleaned[1]]
    );

    con.query(emoIncrementQry);
  }
}

const logPinnedMessage = (msgid) => {

  if(msgid) {
    const pinLogQry = mysql.format("INSERT INTO " + pinTblName + "(msgid) VALUES ?", [msgid]);
    con.query(pinLogQry);
  }
}


///TODO finish this
const getPinnedMsgIfExists = async (msgid) => {

  let res = [];
  var query = con.format('SELECT EXISTS (SELECT 1 FROM ' + pinTblName + ' WHERE msgid = \'?\') AS found;');

  const results = await getResults(query);
  console.log(results);
  res = results;

  //TODO return true or false based on value of found
  return res;

}

// TODO test that this works with the getResults query moved out
const getTopEmoji = async (number) => {

  let res = [];

  var query = con.format('SELECT emoji, frequency, emoid, animated FROM ' + emojiTblName + ' ORDER BY frequency DESC LIMIT ?', [number]);

  try {
    const results = await getResults(query);
    console.log(results);
    res = results;

  } catch (e) {
    console.err(e);
  }
  return res;

}


const cleanLog = (message) => {
  const userIdRegex = /<@\d+>/g;
  const groupIdRegex = /<@&\d+>/g;
  const addressRegex = /\d{1,5}\s{1}\w+\s{1}\w+\s\w+/g;
  const phoneNumRegex = /(\([0-9]{3}\)|[0-9]{3})( |-)[0-9]{3}-[0-9]{4}/g;
  const emailRegex = /[a-zA-Z0-9]+@[a-zA-Z0-9]+.[a-zA-Z0-9]+/g;
  const urlRegex = /(http:\/\/|https:\/\/)[^\s]+/g;

  const spaceRegex = /\s+/g;

  //todo add logfile encryption

  let logMsg = message.content
    .replace(userIdRegex, '')
    .replace(groupIdRegex, '')
    .replace(phoneNumRegex, '')
    .replace(emailRegex, '')
    .replace(urlRegex, '')
    .replace(addressRegex, '');


  let tmpAry = logMsg.split(' ');


  let msgAry = tmpAry.filter((word) => {
    return !filterWordArray.includes(word);
  })

  let cleanMsg = msgAry.join(' ').replace(spaceRegex, ' ').trim();

  if (cleanMsg.length > 0) {
    fs.appendFile(logFile, cleanMsg + "\n", (err) => {
      if (err) {
        console.log("Error writing to chatlog file " + logFile + ": " + err);
      }
    });
  }
}

export default { cleanLog, countEmoji, initializeEmojisList, getTopEmoji };