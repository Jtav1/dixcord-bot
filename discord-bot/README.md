# dixcord-bot

Discord bot for the Dixon Cox Butte Preservation Society. This README covers the bot only; the `webapi/` directory and related web API assets are documented separately.

---

## Dependency: API backend

The bot **depends on its web API backend** for almost all behavior. It loads configuration at startup (`GET /api/config`) and does not run meaningfully without a reachable API and valid credentials. The API provides:

- Configuration (pin threshold, emoji IDs, channels, etc.)
- Trigger–response pairs, link replacements, and bot responses (fortune, link-fixer)
- Storage and leaderboards for plusplus, emojis, reposts, and pin logging

### Connecting to the API

Set these environment variables so the bot can authenticate and talk to the backend. There are **no in-code defaults**—if any of the three are missing, API calls will fail.

| Variable          | Description                                 |
| ----------------- | ------------------------------------------- |
| `WEBAPI_URL`      | Base URL of the web API (no trailing slash) |
| `WEBAPI_USERNAME` | Login email for the API                     |
| `WEBAPI_PASSWORD` | Login password for the API                  |

The bot logs in via `POST /api/auth/login` with `email` and `password`, stores the JWT, and re-authenticates automatically when it receives a 401 from a request. Ensure the web API is running and that this user exists before starting the bot. Use the same credentials as configured for the web API (for example its admin user).

### Container startup (Docker)

The Discord bot image runs [`scripts/start.js`](scripts/start.js) instead of `bot.js` directly. On every start it:

1. **Waits for the web API** — polls `GET ${WEBAPI_URL}/health` (no auth) every 2 seconds, up to 30 attempts, until the response is `200` with `{ "status": "ok" }`. If the API never becomes ready, the process exits with an error so the bot does not crash immediately on `getAllConfigurations()`.
2. **Optionally deploys slash commands** — if `DEPLOY_SLASH_COMMANDS` is set to a truthy value (`1`, `true`, or `yes`, case-insensitive), it runs `node delete-all-commands.js` (clears all guild slash commands on Discord), then `node deploy-commands.js`, then starts the bot. If either step fails, the container exits without starting the bot.
3. **Starts the bot** — `node bot.js` with inherited stdio.

When running under **docker compose** at the repo root, `discord-bot` depends on `webapi` with `condition: service_healthy`, and the web API service defines a health check against `/health`. Point `WEBAPI_URL` at the API service from the bot container, e.g. `http://webapi:3000`.

| Variable                  | Description                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEPLOY_SLASH_COMMANDS`   | Optional. When unset, empty, or falsy (`0`, `false`, etc.), only the health wait runs, then the bot starts. Set to `true` or `1` to clear all guild `/` commands, then re-register from `commands/` on each container start. |

---

## What the bot does

### Message handling (on every non-bot message)

- **Link fixing** – If the message contains links from configured source hosts (e.g. x.com, twitter, instagram, tiktok, bsky), the bot asks the API for a “fixed” embed-friendly link and replies with it.
- **Trigger responses** – If the message (stripped) matches a trigger string from the API, the bot replies with a random response for that trigger (e.g. “take a look at this” → image).
- **Fortune (8-ball)** – If you @mention the bot and the message ends with `?`, the bot replies with a random fortune from the API.
- **Emoji tracking** – Detects emojis in the message and records usage in the API; if you reply with exactly one of the configured +/- emojis, it applies a plus or minus to the replied-to user.
- **Plus/minus from text** – Sends message content to the API so it can parse `word++`, `user++`, and `--` (filtering and scoring are done in the API).

### Reaction handling

- **Pinning** – When a message reaches the configured number of “pin” emoji reactions, the bot posts an embed to a pin channel (author, content, who pinned), logs the pin via the API, and may reply with a random pin quip.
- **Plus/minus votes** – Adding or removing the configured plus/minus emoji on a message records or reverses a vote for that message’s author (no self-vote).
- **Emoji stats** – Any other emoji reaction is counted as emoji usage (for leaderboards).
- **Repost** – A configured “repost” emoji records an accusation; removing it withdraws that accusation.

### Slash commands

| Command                     | Description                                                                     |
| --------------------------- | ------------------------------------------------------------------------------- |
| `/dixbot`                   | Short help/reference (link fix, triggers, 8-ball, spam note, logging note).     |
| `/plusplus-total`           | Shows the ++ score for a given word or user (optional `word` / `user` options). |
| `/plusplus-leaderboard`     | Top and bottom 5 plusplus scores.                                               |
| `/plusplus-top-voters`      | Top 3 plusplus voters.                                                          |
| `/plusplus-voter-frequency` | How many times a user has +/-’d something (optional `user`).                    |
| `/top-emojis`               | Top 5 most used emojis in the server.                                           |
| `/reposts-by-user`          | Number of reposts for a given user.                                             |
| `/top-reposters`            | Top 5 “worst reposters” by repost count.                                        |

---

## Environment variables

### Discord (required)

| Variable            | Description                                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_TOKEN`     | Bot token.                                                                                                                                                                                                                                            |
| `DISCORD_CLIENT_ID` | Application (client) ID.                                                                                                                                                                                                                              |
| `DISCORD_GUILD_ID`  | Guild (server) ID for command registration and context.                                                                                                                                                                                               |
| `DEV_FLAG`          | Must be non-empty. Used in `configVars.js` for dev vs production (data paths and announce channel behavior). For example `DEV_FLAG=1` for development; use a value that matches your deployment (see `configVars.js` for how production is detected). |

### Web API

See [Connecting to the API](#connecting-to-the-api) above. Copy `.env.example` to `.env` and fill in values when developing locally.

### Slash command auto-deploy (optional)

See [Container startup (Docker)](#container-startup-docker). For local runs you can mirror the same flow with `node scripts/start.js` from the `discord-bot` directory (still requires a reachable `WEBAPI_URL`).

---

## Running the bot

From the `discord-bot` directory (so `deploy-commands.js` and imports resolve correctly):

- **Install:** `npm ci` (or `npm install`)
- **Production-style:** `npm run run` → `node bot.js`
- **Dev (watch restarts):** `npm run dev` → `node --watch bot.js`

Ensure the web API is up and env vars are set before starting.

### Docker

The `Dockerfile` uses Node 22, installs dependencies with `npm ci`, copies `scripts/`, and runs `node ./scripts/start.js` (wait for API → optional delete-all + deploy → `bot.js`). Build and run from the `discord-bot` context so paths match.

---

## Deploying slash commands

Slash commands are registered for the guild in `configVars.js` (`DISCORD_GUILD_ID`).

- **Register or refresh commands:** `node deploy-commands.js`
- **Remove all guild commands:** `node delete-all-commands.js`

Run these from the `discord-bot` directory after installing dependencies.
