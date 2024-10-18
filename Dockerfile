FROM node:alpine3.19
WORKDIR /usr/src/app

COPY ./commands ./commands
COPY ./database ./database
COPY ./events ./events
COPY ./logging ./logging
COPY ./middleware ./middleware
COPY ./package*.json ./

COPY ./configVars.js ./
COPY ./bot.js ./

RUN npm update -g npm
RUN npm ci

CMD ["node", "./bot.js"]
