FROM node:alpine3.16
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY ./src .
COPY ./assets .

# EXPOSE 3000

# ENTRYPOINT [ "node", "./src/bot.js" ]
CMD ["node", "bot.js"]