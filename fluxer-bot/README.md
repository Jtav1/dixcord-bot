# fluxer-bot

Fluxer bot built on [fluxer.js](https://fluxer.js.org/) (`@fluxerjs/core`). At near-full feature parity with `discord-bot/` — see [`FEATURE_PARITY.md`](FEATURE_PARITY.md) for the per-command/feature checklist and `../docs/bot-features.md` for how each feature is implemented across both bots (including where fluxer.js's lack of slash commands or other API gaps force a different implementation here).

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
- `configVars.js` — env var reads (token, guild id, instance url, command prefix, webapi credentials).
- `commandRegistry.js` — shared `commands` array, filled by `bot.js`'s loader; imported by files that can't receive `commands` as a handler arg.
- `api/client.js` — webapi JWT client (login, auto-relogin on 401).
- `events/connection/ready.js` — logs once connected.
- `commands/utilities/` — 17 commands, `{ cmdName, data, execute }` modules, dispatched as `FLUXER_COMMAND_PREFIX`-prefixed text commands (default `!`) since fluxer.js has no slash-command primitive. See `FEATURE_PARITY.md` for the full list and `../docs/bot-features.md` for how each one works.
- `events/` — message pipeline, reactions, pin system, moderation, and guild lifecycle handlers ported from `discord-bot/`, plus the fluxer-only `color-me` feature. See `../docs/bot-features.md`.
- `scheduler/` — scheduled-message delivery, polling webapi every 15s via `setInterval`.
- `scripts/wait-for-webapi.js`, `scripts/start.js` — container startup sequence, mirrors `discord-bot/scripts/` (no slash-command deploy step needed here).
