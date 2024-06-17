const { logFile, log_filter_list_loc, guildId, filterWordArray, mysqlHost, mysqlPort, mysqlUser, mysqlPw, mysqlDb, } = require('../configVars.js');
const fs = require('node:fs');

const mysql = require('mysql2');

// runs on initialization
const connection = mysql.createConnection(
  'mysql://' + mysqlUser + ':' + mysqlPw + '@' + mysqlHost + ':' + mysqlPort + '/' + mysqlDb
);

connection.addListener('error', (err) => {
  console.log(err);
});

const tblCreateQuery = mysql.format(
  "CREATE TABLE IF NOT EXISTS emoji_frequency " + 
    "(emoid VARCHAR(255) NOT NULL, " + 
    "emoji VARCHAR(255) NOT NULL, " +
    "frequency INT NOT NULL, " +
    "animated BOOLEAN, " +
    "type VARCHAR(50) NOT NULL, " +
    "PRIMARY KEY (emoid))");

connection.query(tblCreateQuery);
console.log('-- Emoji table tracking created');

function emojiInit(emojiObjectList) {
  connection.query("DELETE FROM emoji_frequency WHERE frequency = 0 and type = 'emoji'");

  let emojiArray = [];

  emojiObjectList.forEach((e) => {
    emojiArray.push(([`${e.id}`, `${e.name}` , 0, e.animated, `${e.type}`]));
  });

  const emoInsertQry = mysql.format(
    "INSERT INTO emoji_frequency (emoid, emoji, frequency, animated, type) VALUES ? ON DUPLICATE KEY UPDATE emoid=emoid",
    [emojiArray]
  );

  connection.query(emoInsertQry);
}

function emojiIncrement(emoji){
  let emoCleaned = emoji.replace("<", "").replace(">", "").split(":").slice(1);
  
  if(emoCleaned.length == 2){
    const emoIncrementQry = mysql.format(
      "UPDATE emoji_frequency SET frequency = frequency + 1 WHERE emoji = ? AND emoid = ?",
      [emoCleaned[0], emoCleaned[1]]
    );

    connection.query(emoIncrementQry);
  }

}


module.exports = {
	cleanLog: function(message) {
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
  },
  countEmoji: function(emoji){
    emojiIncrement(emoji);
  },
  initializeEmojisList: function(emojiObjectList){
    emojiInit(emojiObjectList);
  }

}