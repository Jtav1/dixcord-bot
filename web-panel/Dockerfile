# Build stage: compile Vite assets
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage: serve static build and proxy /api to webapi
FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV=production
EXPOSE 3001

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.js ./

RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app
USER app

CMD ["node", "server.js"]
