FROM node:26-alpine
WORKDIR /usr/src/app

# Install deps first for better layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Application code (everything not excluded by .dockerignore)
COPY . .

CMD ["node", "./scripts/start.js"]
