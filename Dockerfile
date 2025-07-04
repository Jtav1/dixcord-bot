FROM node:alpine3.19
WORKDIR /usr/src/app

COPY ./commands ./commands
COPY ./database ./database
COPY ./events ./events
COPY ./logging ./logging
COPY ./database ./database
COPY ./package*.json ./
COPY ./delete-all-commands.js ./
COPY ./deploy-commands.js ./

COPY ./configVars.js ./
COPY ./bot.js ./

RUN npm update -g npm
RUN npm ci

CMD ["node", "./bot.js"]
# CMD ["sh", "-c", "node ./delete-all-commands.js && node ./deploy-commands.js && node ./bot.js"]