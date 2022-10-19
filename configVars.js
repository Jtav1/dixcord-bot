const fs = require('fs');
const take_a_look_list_file = './data/take_a_look_list.txt';

fs.writeFile(take_a_look_list_file, '', { flag: 'wx' }, function (err) {
  console.log("./data/take_a_look_list.tx exists, skipping creation")
});

let token = process.env.DISCORD_TOKEN;

if(token == null){
  token = "NzEwNjczNTE3NDcyOTA3MzU1.G6wAoH.m8mR3Pkjj7kKl0vLLzIKj9jiAcCMFvYp4ZSPqM";
}

module.exports = {
  token,
  take_a_look_list_file,
};