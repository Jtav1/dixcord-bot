const { logFile, log_filter_list_loc, filterWordArray } = require('../configVars.js');



module.exports = {
	cleanLog: function(message) {
    const userIdRegex = /<@\d{18}> /;
    const addressRegex = /\d{1,5}\s\w.\s(\b\w*\b\s){1,2}\w*\./
    const phoneNumRegex = /^(\([0-9]{3}\) |[0-9]{3}-)[0-9]{3}-[0-9]{4}$/
    const emailRegex = /[a-zA-Z0-9]+@[a-zA-Z0-9]+.[a-zA-Z0-9]+/
    const spaceRegex = /\s+/g;
    //todo remove attachments and URLs


    let logMsg = message.content
      .replace(userIdRegex, '')
      .replace(addressRegex, '')
      .replace(phoneNumRegex, '')
      .replace(emailRegex, '');

    filterWordArray.forEach((keyword) => {

      //todo split, compare ignore case, rejoin without
      logMsg = logMsg.replace(keyword, '');
    })

    logMsg = logMsg.replace(spaceRegex, ' ').trim();

    console.log("LOGGING: " + logMsg);
    //todo log here

  }

}