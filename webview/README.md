# Dixcord View

Node.js + Vite frontend scaffold for the dixcord-bot public view. Uses [webapi](../webapi/) as its only backend in both development and production.

All API traffic goes to same-origin `/api`, which is proxied to `WEBAPI_URL` from `.env`.

## Stack

- **Node.js** + **Vite** (dev/build)
- **Express** (production static server + `/api` proxy)
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

Default URL: `http://localhost:3002`

Ensure [webapi](../webapi/) is running and `WEBAPI_URL` in `.env` points to it.

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

## Environment

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `PORT` | `3002` | Dev server and production server port |
| `WEBAPI_URL` | `http://localhost:3000` | webapi base URL; proxied at `/api` |
| `WEBVIEW_USERNAME` | — | Service account email for webapi login (server-side only) |
| `WEBVIEW_PASSWORD` | — | Service account password for webapi login (server-side only) |

The dev and production servers log in to webapi with `WEBVIEW_USERNAME` / `WEBVIEW_PASSWORD` and attach the JWT to proxied `/api` requests. Credentials are never sent to the browser.

Client code should call `/api/...` (see `src/lib/api.js`). No build-time API URL is required.
