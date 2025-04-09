// import something from middleware
import { plusplus, minusminus } from "../../../middleware/plusplus.js";
import { getAllLogFilterKeywords } from "../../../middleware/filters.js";

let filterWordArray = await getAllLogFilterKeywords();
filterWordArray = filterWordArray.map((w) => {
  return w.keyword.toLowerCase();
});

export const doplus = async (string, typestr, voterid) => {
  // reminder typestr will be 'user' or 'word' for now

  if(typestr != "user" || (typestr == "user" && string != voterid)) {
    plusplus(string, typestr, voterid).then(() => {
      //console.log("plusplus done");
    }).catch((err) => {
      console.log("plusplus error");
      console.log(err);
    });
  }
};

export const dominus = async (string, typestr, voterid) => {
  // reminder typestr will be 'user' or 'word' for now

  if(typestr != "user" || (typestr == "user" && string != voterid)) {
    minusminus(string, typestr, voterid).then(() => {
     // console.log("minusminus done");
    }).catch((err) => {
      console.log("minusminus error");
      console.log(err);
    });
  }
};

export const plusMinusMsg = async (rawMessage) => {
  //console.log(rawMessage.author.id);

  const message = rawMessage.content;
  const voterid = rawMessage.author.id;
  let matches = [];

  // Find all instances of ++ or -- with optional whitespace
  const regex = /(\S+)\s*(\+\+|\-\-)/g;
  let match;

  while ((match = regex.exec(message)) !== null) {
    // match[1] contains the characters before ++ or --
    // match[2] contains either ++ or --
    matches.push({ target: match[1], type: match[2] });
  }

  if (matches.length > 0) {
    matches.forEach((m) => {

      let target = m.target;

      const isUserMention = (str) => {
        const mentionRegex = /^<@!?(\d+)>$/;
        return mentionRegex.test(str);
      };

      let matchtype = "word";

      if (isUserMention(target)) {

        //strip markup just send the id forward
        target = target.replace('<@', '').replace('>', '');
        if(target === rawMessage.author.id) {
          matchtype = null;
        } else {
          matchtype = "user";
        }

      }

      target = target.replace(/[-+\s]/g, '');

      if (filterWordArray.includes(target.toLowerCase())) {
        matchtype = null;
      }

      if(target.length < 1 ) matchtype = null;

      if(m.type === "++" && matchtype) {
        doplus(target, matchtype, voterid);
      } else if (m.type === "--") {
        dominus(target, matchtype, voterid);
      }
    });
  }
};
