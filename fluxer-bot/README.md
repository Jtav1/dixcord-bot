# fluxer-bot

Fluxer bot built on [fluxer.js](https://fluxer.js.org/) (`@fluxerjs/core`). Base template: logs into a Fluxer instance and confirms it can see the configured community/guild. No feature commands/events are implemented yet — see root `CLAUDE.md` and `discord-bot/` for the feature set this will eventually replicate.

## Setup

```bash
cp .env.example .env   # fill in FLUXER_TOKEN, FLUXER_GUILD_ID, WEBAPI_* (optional for now)
npm install
npm run dev            # node --watch bot.js
npm run run             # node bot.js
npm start                # node scripts/start.js (waits for webapi /health, then bot.js)
```

## Layout

- `fluxerClient.js` — constructs the singleton `Client` (via instance discovery when `FLUXER_INSTANCE_URL` is set, for self-hosted instances). Separate from `bot.js` because fluxer.js event handlers aren't passed the client (unlike discord.js), so event files import it directly.
- `bot.js` — login, dynamic `events/`/`commands/` loaders (same shape as `discord-bot/bot.js`).
- `configVars.js` — env var reads (token, guild id, instance url, webapi credentials).
- `api/client.js` — webapi JWT client (login, auto-relogin on 401); not yet called by anything.
- `events/connection/ready.js` — logs once connected.
- `commands/` — empty; add `{ cmdName, data, execute }` modules here once slash-command support (`@fluxerjs/builders` + `@fluxerjs/rest`) is wired up.
- `scripts/wait-for-webapi.js`, `scripts/start.js` — container startup sequence, mirrors `discord-bot/scripts/`.
