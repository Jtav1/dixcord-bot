// import something from middleware

export const plusplus = async (string, typestr) => {
  console.log("doing a plusplus on " + string);
};

export const minusminus = async (string, typestr) => {
  console.log("doing a minusminus on " + string);
};

export const plusMinusMsg = async (rawMessage) => {
  console.log(rawMessage.content);
};
