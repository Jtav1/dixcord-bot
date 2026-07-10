# Dixcord View

Public Vue frontend for dixcord-bot stats and archives. Uses [webapi](../webapi/) as its only backend in both development and production.

All API traffic goes to same-origin `/api`, which is proxied to `WEBAPI_URL`. The server logs in with the web-view service account and attaches a JWT; credentials never reach the browser.

---

## Features overview

| Page | Route | What it shows |
| ---- | ----- | ------------- |
| **System Status** | `/system-status` (default) | Webapi / DB / bot heartbeat and cache status |
| **Pin Archive** | `/pin-archive` | Paginated history of pinned messages |
| **Emoji Count** | `/emoji-count` | Server emoji usage leaderboard |
| **Sticker Count** | `/sticker-count` | Server sticker usage leaderboard |
| **PlusPlus Rankings** | `/plusplus-rankings` | Top/bottom plusplus scores |
| **Statistics** | `/statistics` | Aggregate counts (members, emojis/stickers, pins, triggers, etc.) |

Also includes light/dark theme toggle and static serving of local emoji/sticker files under `/files` when present.

---

## Stack

- **Vue 3** + **Vue Router** + **Vuetify**
- **Vite** (dev/build)
- **Express** (production static server + `/api` proxy, Helmet, rate limit)
- **dotenv** for config

---

## Environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `3002` | Dev server and production server port |
| `WEBAPI_URL` | `http://localhost:3000` | webapi base URL; proxied at `/api` (in Docker Compose use e.g. `http://webapi:3000`) |
| `WEBVIEW_USERNAME` | — **required** | Service account email for webapi login (server-side only; must match webapi `WEBVIEW_USERNAME`) |
| `WEBVIEW_PASSWORD` | — **required** | Service account password (must match webapi `WEBVIEW_PASSWORD`) |
| `WEBVIEW_API_RATE_LIMIT_MAX` | `120` | Per-IP rate limit for `/api` proxy (requests per minute) |

Missing `WEBVIEW_USERNAME` / `WEBVIEW_PASSWORD` causes the production server to exit on startup. Client code should call `/api/...` only (see `src/lib/api.js`); no build-time API URL is required.

---

## Setup

```bash
cp .env.example .env
npm install
```

Ensure [webapi](../webapi/) is running and the web-view service account exists there.

## Development

```bash
npm run dev
```

Default URL: `http://localhost:3002`

## Production

```bash
npm run build
npm start
```

## Docker

From repo root (set `WEBAPI_URL=http://webapi:3000` in `web-view/.env` for compose networking):

```bash
docker compose build web-view
docker compose up web-view
```
