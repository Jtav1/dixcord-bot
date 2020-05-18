const Discord = require('discord.js');
const dotenv = require('dotenv').config();
const client = new Discord.Client();

const path = require('path');
const fs = require('fs');

const getTakeALookAtThisPath = path.join(__dirname, 'take_a_look_at_this');
const useURLsForTakeALookAtThis = true;

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});
   
client.on('message', msg => {
    processMessageForResponse(msg);
});

const processMessageForResponse = (msg) => {
    //"Take a look at this" meme
    if (msg.content.toLowerCase().includes('a')) {
            const fileName = getTakeALookAtThisFilename();

            let file;
            if(useURLsForTakeALookAtThis) file = new Discord.MessageAttachment('./take_a_look_at_this/' + fileName) ;
            else file = new Discord.MessageAttachment(fileName) ;
    
            const exampleEmbed = {
                image: {
                    url: fileName,
                },
            };
            
            msg.channel.send({ files: [file] });
        }
};

const getTakeALookAtThisFilename = () => {

    // let fileArray = [];
    let urlArray = [];

    // fs.readdirSync(getTakeALookAtThisPath).forEach(file => {
    //     fileArray.push(file);
    // });
    
    try {  
        var data = fs.readFileSync((process.env.TAKE_A_LOOK_AT_THIS_LINKS_FILE), 'utf8');
        urlArray.push(data.split("\r\n"));    
    } catch(e) {
        console.log('Error:', e.stack);
    }

    if(useURLsForTakeALookAtThis) return urlArray[Math.floor(Math.random() * urlArray.length)];
    // else return fileArray[Math.floor(Math.random() * fileArray.length)];    
};

client.login(process.env.BOT_SECRET_TOKEN)