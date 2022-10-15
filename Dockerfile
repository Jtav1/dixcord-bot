FROM node:alpine3.16
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY ./src .

EXPOSE 3000

CMD [ "node", "index.js" ]