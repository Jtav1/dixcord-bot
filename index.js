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
            if(useURLsForTakeALookAtThis) file = new Discord.MessageAttachment(fileName) ;
            else file = new Discord.MessageAttachment('./take_a_look_at_this/' + fileName) ;
    
            const exampleEmbed = {
                image: {
                    url: fileName,
                },
            };
            console.log(file);
            msg.channel.send({ files: [file] });
        }
    };

const getTakeALookAtThisFilename = () => {

    let fileArray = [];
    let urlArray = [];

    if(useURLsForTakeALookAtThis){
        try {  
            var data = fs.readFileSync((process.env.TAKE_A_LOOK_AT_THIS_LINKS_FILE), 'utf8');
            urlArray = data.split("\r\n");    
        } catch(e) {
            console.log('Error:', e.stack);
        }
        return urlArray[Math.floor(Math.random() * urlArray.length)];
        
    } else {
        fs.readdirSync(getTakeALookAtThisPath).forEach(file => {
            fileArray.push(file);
        });

        return fileArray[Math.floor(Math.random() * fileArray.length)];
    }
      
};

client.login(process.env.BOT_SECRET_TOKEN)