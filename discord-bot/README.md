# dixcord-bot

Discord bot for the Dixon Cox Butte Preservation Society. This README covers the bot only; the `webapi/` backend and `web-view/` public site are documented separately.

The bot **depends on the web API** for almost all behavior. It loads configuration at startup (`GET /api/config`) and does not run meaningfully without a reachable API and valid credentials.

---

## Features overview

### Message handling (every non-bot message)

- **Link fixing** – Rewrites configured social hosts (e.g. x.com, twitter, instagram, tiktok, bsky) into embed-friendly links via the API.
- **Trigger responses** – If the message matches a trigger string, replies using the trigger’s `selection_mode`:
  - `random` — uniform random
  - `ordered` — round-robin by `response_order`
  - `weighted` — weighted random
  - `lotto` — weighted random plus optional `lotto_prize` side effect; prize handlers must be defined in [`utilities/lottoPrizes.js`](utilities/lottoPrizes.js) (keyed by `prize_string`)
- **Fortune (8-ball)** – @mention the bot with a message ending in `?` for a random fortune from the API.
- **Emoji tracking** – Records emoji usage; a reply with exactly one configured +/- emoji applies plus/minus to the replied-to user.
- **Plus/minus from text** – Parses `word++` / `user++` / `--` via the API.
- **Scheduled reminders** – Natural-language reminder messages are stored via the API and delivered later by the in-process scheduler.

### Reaction handling

- **Pinning** – At the configured pin-emoji threshold, posts a pin embed, logs the pin, and may reply with a pin quip.
- **Plus/minus votes** – Add/remove configured +/- emoji to record or reverse a vote (no self-vote).
- **Emoji stats** – Other emoji reactions count toward leaderboards.
- **Repost** – Configured repost emoji records or withdraws an accusation.

### Slash commands

| Command                     | Description                                              |
| --------------------------- | -------------------------------------------------------- |
| `/dixbot`                   | Short help/reference                                     |
| `/plusplus-total`           | ++ score for a word or user                              |
| `/plusplus-leaderboard`     | Top and bottom 5 plusplus scores                         |
| `/plusplus-top-voters`      | Top 3 plusplus voters                                    |
| `/plusplus-voter-frequency` | How many times a user has +/-’d something                |
| `/top-emojis`               | Top 5 most used emojis                                   |
| `/reposts-by-user`          | Repost count for a user                                  |
| `/top-reposters`            | Top 5 reposters                                          |
| `/pin-message`              | Manually pin a message into the pin flow                 |
| `/scheduled-list`           | List your upcoming scheduled reminders (UTC)             |
| `/scheduled-update`         | Update a pending reminder’s time and/or message          |
| `/scheduled-delete`         | Delete a pending reminder by id                          |

### Runtime behavior

- Authenticates to webapi with a JWT; re-logins on 401.
- Polls cache version and refreshes in-memory triggers, link hosts, and config when invalidated.
- Sends heartbeats to webapi; waits for `/health` before starting in Docker.
- Optionally clears and re-registers guild slash commands on container start.

---

## Environment variables

Copy `.env.example` to `.env` for local development. There are **no in-code defaults** for Discord or webapi credentials—missing values cause startup/API failures.

### Discord

| Variable                                 | Required | Description |
| ---------------------------------------- | -------- | ----------- |
| `DISCORD_TOKEN`                          | yes      | Bot token |
| `DISCORD_CLIENT_ID`                      | yes      | Application (client) ID |
| `DISCORD_GUILD_ID`                       | yes      | Guild ID for command registration and bot context |
| `DEV_FLAG`                               | yes      | Must be non-empty. Loosely `== false` (e.g. `0`) → production (`dataDirectory=/data`); otherwise development (`./data`) |
| `DISCORD_USER_MAPPING_IMPORT_CHANNEL_ID` | no       | Extra text channel whose non-bot message authors are merged into user-mapping sync (must be in `DISCORD_GUILD_ID`) |
| `PERMISSIONS`                            | no       | Discord permissions mask for invite URLs; not read by the bot process |

### Web API

| Variable          | Required | Description |
| ----------------- | -------- | ----------- |
| `WEBAPI_URL`      | yes      | Base URL of the web API (no trailing slash). In Docker Compose use e.g. `http://webapi:3000` |
| `WEBAPI_USERNAME` | yes      | Login email; should match webapi `BOT_USERNAME` |
| `WEBAPI_PASSWORD` | yes      | Login password; should match webapi `BOT_PASSWORD` |

The bot logs in via `POST /api/auth/login`, stores the JWT, and re-authenticates on 401.

### Startup / files

| Variable                | Required | Description |
| ----------------------- | -------- | ----------- |
| `DEPLOY_SLASH_COMMANDS` | no       | Truthy (`1`, `true`, `yes`) → on start (via `scripts/start.js`), clear all guild slash commands then re-register from `commands/`. Falsy/unset → skip deploy |
| `PIN_FILES_DIR`         | no       | Directory for shared pin attachment files (default: `./files` under `discord-bot`) |

---

## Connecting to the API

Ensure webapi is running and the bot service account exists before starting. Under Docker Compose, `discord-bot` depends on `webapi` with `condition: service_healthy`.

### Container startup (`scripts/start.js`)

1. Poll `GET ${WEBAPI_URL}/health` every 2s (up to 30 attempts) until `{ "status": "ok" }`.
2. Optionally deploy slash commands when `DEPLOY_SLASH_COMMANDS` is truthy.
3. Start `node bot.js`.

---

## Running the bot

From the `discord-bot` directory:

- **Install:** `npm ci` (or `npm install`)
- **Production-style:** `npm run run` → `node bot.js`
- **Dev (watch):** `npm run dev` → `node --watch bot.js`
- **Docker-style start:** `node scripts/start.js` (health wait → optional deploy → bot)

### Docker

The image uses Node 22, `npm ci`, and `node ./scripts/start.js`. Build from the `discord-bot` context.

---

## Deploying slash commands

Registered for the guild in `DISCORD_GUILD_ID`:

- **Register/refresh:** `node deploy-commands.js`
- **Remove all guild commands:** `node delete-all-commands.js`

Run from the `discord-bot` directory after installing dependencies.
