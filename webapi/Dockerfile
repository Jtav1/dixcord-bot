FROM node:24.20-alpine3.24 AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --omit=optional

# Production stage
FROM node:24.20-alpine3.24
WORKDIR /app

ENV NODE_ENV=production
EXPOSE 3000

# Copy installed dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Run as non-root; the app needs to create data/ itself for the default SQLite path
RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app \
  && mkdir -p data && chown -R app:app /app
USER app

CMD ["node", "index.js"]
