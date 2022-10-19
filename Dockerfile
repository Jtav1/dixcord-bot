FROM node:alpine3.16
WORKDIR /usr/src/app

COPY ./commands ./commands
COPY ./events ./events
COPY ./*.js ./
COPY ./package*.json ./

RUN npm ci

CMD ["node", "./bot.js"]