# Dixcord Admin Panel

Node.js + Vite frontend scaffold for the dixcord-bot admin panel. Uses [webapi](../webapi/) as its only backend in both development and production.

All API traffic goes to same-origin `/api`, which is proxied to `WEBAPI_URL` from `.env`. The
proxy authenticates to webapi server-side as the `ADMIN_USERNAME`/`ADMIN_PASSWORD` service
account (see [`lib/webapiAuth.js`](lib/webapiAuth.js), same pattern as [webview](../webview/)) —
the browser never sees a webapi token.

Internal-only: this app is never meant to be exposed to the internet.

## Stack

- **Node.js** + **Vite** (dev/build)
- **Express** (production static server + authenticated `/api` proxy)
- **helmet** + per-IP rate limiting on `/api`
- **dotenv** for config

## Setup

```bash
cp .env.example .env
npm install
```

## Development

```bash
npm run dev
```

Default URL: `http://localhost:3001`

Ensure [webapi](../webapi/) is running and `WEBAPI_URL` in `.env` points to it.

## Production

```bash
npm run build
npm start
```

## Docker

From repo root (set `WEBAPI_URL=http://webapi:3000` in `webadmin/.env` for compose networking):

```bash
docker compose build webadmin
docker compose up webadmin
```

## Environment

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `3001` | Dev server and production server port |
| `WEBAPI_URL` | `http://localhost:3000` | webapi base URL; proxied at `/api` |
| `ADMIN_USERNAME` | — | Admin service account email; must match webapi `ADMIN_USERNAME` |
| `ADMIN_PASSWORD` | — | Admin service account password; must match webapi `ADMIN_PASSWORD` |
| `WEBADMIN_API_RATE_LIMIT_MAX` | `120` | Per-IP rate limit for `/api` proxy (requests per minute) |

Client code should call `/api/...` (see `src/lib/api.js`). No build-time API URL is required.
