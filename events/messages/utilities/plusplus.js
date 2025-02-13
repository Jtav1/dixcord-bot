// import something from middleware

export const plusplus = async (string, typestr) => {
  console.log("doing a plusplus on " + string);
};

export const minusminus = async (string, typestr) => {
  console.log("doing a minusminus on " + string);
};

export const plusMinusMsg = async (rawMessage) => {
  console.log(rawMessage.author.id);

  const message = rawMessage.content;
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

      const isUserMention = (str) => {
        const mentionRegex = /^<@!?(\d+)>$/;
        return mentionRegex.test(str);
      };

      let matchtype = "word";

      if (isUserMention(m.target)) {
        if(m.target.replace('<@', '').replace('>', '') === rawMessage.author.id) {
          matchtype = null;
        } else {
          matchtype = "user";
        }
      }

      if(m.type === "++") {
        console.log("found plusplus " + matchtype + ": " + m.target + ".")
      } else if (m.type === "--") {
        console.log("found minusminus " + matchtype + ": " + m.target + ".")
      }
    });
  }
};
