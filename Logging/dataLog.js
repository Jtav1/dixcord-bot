const { logFile, log_filter_list_loc, filterWordArray } = require('../configVars.js');
const fs = require('node:fs');

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
  }

}