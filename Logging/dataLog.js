import fs from 'node:fs';
import mysql from 'mysql2/promise';

import {logFile, filterWordArray, mysqlHost, mysqlPort, mysqlUser, mysqlPw, mysqlDb, isDev} from '../configVars.js'; 

// runs on initialization
// const connection = mysql.createConnection(
//   'mysql://' + mysqlUser + ':' + mysqlPw + '@' + mysqlHost + ':' + mysqlPort + '/' + mysqlDb
// );

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

const tblCreateQuery = mysql.format(
  "CREATE TABLE IF NOT EXISTS " + emojiTblName +
    " (emoid VARCHAR(255) NOT NULL, " + 
    "emoji VARCHAR(255) NOT NULL, " +
    "frequency INT NOT NULL, " +
    "animated BOOLEAN, " +
    "type VARCHAR(50) NOT NULL, " +
    "PRIMARY KEY (emoid))");

    con.query(tblCreateQuery);
console.log('-- Emoji table tracking created');


export const initializeEmojisList = async (emojiObjectList) => {
  const connection = await mysql.createConnection({
    host: mysqlHost,
    port: mysqlPort,
    user: mysqlUser,
    password: mysqlPw,
    database: mysqlDb,
  });

  connection.query(tblCreateQuery);

  let emojiArray = [];

  emojiObjectList.forEach((e) => {
    emojiArray.push(([`${e.id}`, `${e.name}` , 0, e.animated, `${e.type}`]));
  });

  con.query("DELETE FROM " + emojiTblName + " WHERE frequency = 0 and type = 'emoji'");

  const emoInsertQry = mysql.format(
    "INSERT INTO " + emojiTblName + " (emoid, emoji, frequency, animated, type) VALUES ? ON DUPLICATE KEY UPDATE emoid=emoid",
    [emojiArray]
  );

  con.query(emoInsertQry);
}


    con.query(emoIncrementQry);
  }

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


  let msgAry = tmpAry.filter((word) =>{
    return !filterWordArray.includes(word);
  })

  let cleanMsg = msgAry.join(' ').replace(spaceRegex, ' ').trim();

  if(cleanMsg.length > 0){
    fs.appendFile(logFile, cleanMsg+"\n", (err) => { 
      if (err) { 
        console.log("Error writing to chatlog file " + logFile + ": " + err); 
      } 
    });
  } 
}

export const countEmoji = (emoji) => {
  let emoCleaned = emoji.replace("<", "").replace(">", "").split(":").slice(1);
  
  if(emoCleaned.length == 2){
    const emoIncrementQry = mysql.format(
      "UPDATE " + emojiTblName + " SET frequency = frequency + 1 WHERE emoji = ? AND emoid = ?",
      [emoCleaned[0], emoCleaned[1]]
    );

    connection.query(emoIncrementQry);
  }
}

export const getTopEmoji = async (number) => {
  try {
    const [results, fields] = await connection.query(
      'SELECT * FROM `table` WHERE `name` = "Page" AND `age` > 45'
    );
  
    console.log(results); // results contains rows returned by server
    console.log(fields); // fields contains extra meta data about results, if available
  } catch (err) {
    console.log(err);
  }
}
