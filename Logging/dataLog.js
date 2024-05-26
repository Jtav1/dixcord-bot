const { logFile, log_filter_list_loc, filterWordArray, mysqlHost, mysqlPort, mysqlUser, mysqlPw, mysqlDb, } = require('../configVars.js');
const fs = require('node:fs');

const mysql = require('mysql2');

// runs on initialization
const connection = mysql.createConnection(
  'mysql://' + mysqlUser + ':' + mysqlPw + '@' + mysqlHost + ':' + mysqlPort + '/' + mysqlDb
);

connection.addListener('error', (err) => {
  console.log(err);
});

const emoji_table_name = 'emoji_frequency'; // table for tracking emoji usage frequency

connection.query(`CREATE TABLE IF NOT EXISTS ${emoji_table_name} (id INT NOT NULL AUTO_INCREMENT, emoji VARCHAR(255) NOT NULL, frequency INT NOT NULL, emoid VARCHAR(255) NOT NULL, PRIMARY KEY (id))`);


function emojiInit() {
  connection.query(`DELETE FROM ${emoji_table_name} WHERE frequency=0`);
  // insert where doesnt exist, all emojis


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
    // increment the frequency column for the given emoji if it exists in the database
  },
  initializeEmojisList: function(emojis){
    emojiInit(emojis);
  }

}