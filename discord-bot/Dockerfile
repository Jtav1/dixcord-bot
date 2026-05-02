FROM node:22-alpine
WORKDIR /usr/src/app

# Install deps first for better layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Application code
COPY ./api ./api
COPY ./commands ./commands
COPY ./events ./events
COPY ./scheduler ./scheduler
COPY ./scripts ./scripts
COPY ./delete-all-commands.js ./deploy-commands.js ./
COPY ./configVars.js ./bot.js ./

CMD ["node", "./scripts/start.js"]
# CMD ["sh", "-c", "node ./delete-all-commands.js && node ./deploy-commands.js && node ./bot.js"]