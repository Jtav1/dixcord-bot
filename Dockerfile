FROM node:alpine3.16
WORKDIR /usr/src/app

COPY ./commands ./commands
COPY ./events ./events
COPY ./package*.json ./

COPY ./configVars.js ./
COPY ./bot.js ./

RUN npm update -g npm
RUN npm ci

CMD ["node", "./bot.js"]
