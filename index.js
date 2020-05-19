const Discord = require('discord.js');
const dotenv = require('dotenv').config();
const client = new Discord.Client();

const path = require('path');
const fs = require('fs');

const getTakeALookAtThisPath = path.join(__dirname, 'take_a_look_at_this');
const useURLsForTakeALookAtThis = true;

//Log bot into server
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setUsername('dixbot');

});

   
//When a message is sent on the server, process the message
client.on('message', msg => {
    processMessageForResponse(msg);
});

//Finally, log in
client.login(process.env.BOT_SECRET_TOKEN)

//Parse message for keywords
const processMessageForResponse = (msg) => {

    console.log(msg.content.toLowerCase());
    console.log(msg.author);

    if(msg.author.username !== "dixbot"){
        //"Take a look at this" meme
        if (msg.content.toLowerCase().includes('take a look at this')) {
            takeALookAtThisResponder(msg);
        }

        if (msg.content.toLowerCase().startsWith('good shit')) {
            goodShitResponder(msg);
        };

        if (msg.content.toLowerCase().includes('ustin makes me feel good')) {
            bustinResponder(msg);
        };

        // if (msg.content.toLowerCase().startsWith('do they ask questions?')) {
        //     questionsResponder(msg);
        // };

        if (msg.content.toLowerCase().includes('dippin dots')) {
            dippinDotsResponder(msg);
        };

        if (msg.content.toLowerCase().includes('big enough')) {
            bigEnoughResponder(msg);
        };

        if (msg.content.toLowerCase().startsWith('!dixbot list')) {
            listResponder(msg);
        };

        if (msg.content.toLowerCase().startsWith('!dixbot poll')) {
            pollResponder(msg);
        };
    }
};

/*
* Resposne handlers
*    Functions that handle text based responses to input message triggers
*/

//Response for TakeALookAtThis meme - return one of a set of urls or images
const takeALookAtThisResponder = (msg) => {
    console.log("Take a look at this detected, replying");

    const fileName = getTakeALookAtThisFilename();

    let file;
    if(useURLsForTakeALookAtThis) file = new Discord.MessageAttachment(fileName) ;
    else file = new Discord.MessageAttachment('./take_a_look_at_this/' + fileName) ;

    const exampleEmbed = {
        image: {
            url: fileName,
        },
    };
    if(useURLsForTakeALookAtThis) msg.channel.send({ files: [file] });
    else msg.channel.send({ files: [file], embed: exampleEmbed });
};

//Response for Good Shit meme - return one of two strings
const goodShitResponder = (msg) => {
    console.log("Good shit detected, replying");

    let responseArray = [":ok_hand::eyes::ok_hand::eyes::ok_hand::eyes::ok_hand::eyes::ok_hand::eyes: good shit go౦ԁ sHit:ok_hand: thats :heavy_check_mark: some good:ok_hand::ok_hand:shit right:ok_hand::ok_hand:there:ok_hand::ok_hand::ok_hand: right:heavy_check_mark:there…ʳᶦᵍʰᵗ ᵗʰᵉʳᵉ) mMMMMᎷМ:100: :ok_hand::ok_hand: :ok_hand:НO0ОଠOOOOOОଠଠOoooᵒᵒᵒᵒᵒᵒᵒᵒᵒ:ok_hand: :ok_hand::ok_hand: :ok_hand: :100: :ok_hand: :eyes: :eyes: :eyes: :ok_hand::ok_hand:Good shit",
    //    ":pg::eyes::pg::eyes::pg::eyes::pg::eyes::pg::eyes: good shit go౦ԁ sHit:pg: thats :heavy_check_mark: some good:pg::pg:shit right:pg::pg:there:pg::pg::pg: right:heavy_check_mark:there…ʳᶦᵍʰᵗ ᵗʰᵉʳᵉ) mMMMMᎷМ:100: :pg::pg: :pg:НO0ОଠOOOOOОଠଠOoooᵒᵒᵒᵒᵒᵒᵒᵒᵒ:pg: :pg::pg: :pg: :100: :pg: :eyes: :eyes: :eyes: :pg::pg:Good shit"
    ]
    msg.channel.send(responseArray[Math.floor(Math.random() * responseArray.length)]);   
}

//Response for Bustin meme - return a single youtube link response
const bustinResponder = (msg) => {
    console.log("Bustin detected, replying");

    msg.channel.send("https://www.youtube.com/watch?v=0tdyU_gW6WE");   
}

//Response for Questions meme - return a single image response
const questionsResponder = (msg) => {
    console.log("Questions detected, replying");

    msg.channel.send("https://i.imgur.com/jl2UeKT.png");   
}

//Response for Questions meme - return one of an array of responses
const dippinDotsResponder = (msg) => {
    console.log("dippin dots detected, replying");

    let responseArray = [
        "https://twitter.com/seanspicer/status/11794196641",
        "https://twitter.com/seanspicer/status/132499281847402496",
        "https://twitter.com/seanspicer/status/116970977878999040",
        "https://twitter.com/seanspicer/status/640955839390576640",
        "https://twitter.com/seanspicer/status/302491904707272704"
    ];


    msg.channel.send(responseArray[Math.floor(Math.random() * responseArray.length)]);   
}

//Response for Questions meme - return one of an array of responses
const bigEnoughResponder = (msg) => {
    console.log("big enough detected, replying");

    let responseArray = [
       "https://www.youtube.com/watch?v=SywExJR4lrI",
       "https://www.youtube.com/watch?v=_k833juQcic",
       "https://www.youtube.com/watch?v=vAe3x86c7Xk",
       "https://www.youtube.com/watch?v=KYTT4orVixE",
       "https://www.youtube.com/watch?v=nAjh3fJuI6k",
       "https://www.youtube.com/watch?v=ypHZ_iKBcoo",
       "https://www.youtube.com/watch?v=2yCRnT5xegI"
    ];


    msg.channel.send(responseArray[Math.floor(Math.random() * responseArray.length)]);   
}

//Response for !list function - return a static response
const listResponder = (msg) => {
    console.log("!list command detected, replying");

    let responseStr = "`DIXBOT AVAILABLE COMMANDS:\n"
                           + "Responds to:\n"
                           + "\t'take a look at this'\n"
                           + "\t'good shit'\n"
                           + "\t'ustin makes me feel good'\n"
                           + "\t'dippin dots'\n"
                           + "\t'big enough'\n"
                           + "Create a Poll:\n"
                           + "\t!dixbot poll \"Poll Question\" \"Response A\" \"Response B\" etc`";

    msg.channel.send(responseStr);   
}

const pollResponder = (msg) => {

    let messageArray = msg.content.substring(12, msg.content.lengt).split("\" \"");;
    let newMessageArray = [];
    messageArray.map((fragment) => {
        newMessageArray.push(fragment.replace("\"", ""));
    });
    
    
    msg.channel.send('`' + newMessageArray.shift() + ":`");

    if(newMessageArray.length > 9) msg.channel.send("Too many options! Keep it to like, 9, please");

    else {
        newMessageArray.forEach((fragment) => {
            if(newMessageArray.indexOf(fragment) === 0) msg.channel.send('`1️⃣' + fragment.trim()+ "`").then((outgoing) => outgoing.react('1️⃣'));   
            if(newMessageArray.indexOf(fragment) === 1) msg.channel.send('`2️⃣' + fragment.trim()+ "`").then((outgoing) => outgoing.react('2️⃣')); 
            if(newMessageArray.indexOf(fragment) === 2) msg.channel.send('`3️⃣' + fragment.trim()+ "`").then((outgoing) => outgoing.react('3️⃣'));
            if(newMessageArray.indexOf(fragment) === 3) msg.channel.send('`4️⃣' + fragment.trim()+ "`").then((outgoing) => outgoing.react('4️⃣'));
            if(newMessageArray.indexOf(fragment) === 4) msg.channel.send('`5️⃣' + fragment.trim()+ "`").then((outgoing) => outgoing.react('5️⃣'));
            if(newMessageArray.indexOf(fragment) === 5) msg.channel.send('`6️⃣' + fragment.trim()+ "`").then((outgoing) => outgoing.react('6️⃣'));
            if(newMessageArray.indexOf(fragment) === 6) msg.channel.send('`7️⃣' + fragment.trim()+ "`").then((outgoing) => outgoing.react('7️⃣'));
            if(newMessageArray.indexOf(fragment) === 7) msg.channel.send('`8️⃣' + fragment.trim()+ "`").then((outgoing) => outgoing.react('8️⃣'));
            if(newMessageArray.indexOf(fragment) === 8) msg.channel.send('`9️⃣' + fragment.trim()+ "`").then((outgoing) => outgoing.react('9️⃣'));
        });
    }
}

/*
* Support functions
*    Functions that support other functions
*/
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
