FROM node:alpine3.16
WORKDIR /usr/src/app

COPY ./commands ./commands
COPY ./events ./events
COPY ./*.js* ./

RUN npm ci

CMD ["node", "./bot.js"]