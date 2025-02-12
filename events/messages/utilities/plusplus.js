// import something from middleware

export const plusplus = async (string, typestr) => {
  console.log("doing a plusplus on " + string);
};

export const minusminus = async (string, typestr) => {
  console.log("doing a minusminus on " + string);
};

export const plusMinusMsg = async (rawMessage) => {
  console.log(rawMessage.content);
  const message = rawMessage.content;
  let matches = [];

  // Find all instances of ++ or --
  const regex = /(\S+)(\+\+|\-\-)/g;
  let match;

  while ((match = regex.exec(message)) !== null) {
    // match[1] contains the characters before ++ or --
    matches.push(match[1]);
  }

  if (matches.length > 0) {
    console.log("Found plusplus/minusminus targets:", matches);
  }
};
