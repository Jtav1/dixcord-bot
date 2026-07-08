# Admin Backend API Routes

Routes added for admin panel backend preparation. **Write** routes require admin role unless noted; **read** routes require any authenticated account (`admin` or `bot`).

## Link replacements

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/link-replacements` | admin or bot | List all |
| GET | `/api/link-replacements/:id` | admin or bot | Get one |
| POST | `/api/link-replacements` | admin | Create `{ source_host, target_host }` |
| PUT | `/api/link-replacements/:id` | admin | Update |
| DELETE | `/api/link-replacements/:id` | admin | Delete |

## Pin quips

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/pin-quips` | admin or bot | List all |
| GET | `/api/pin-quips/random` | admin or bot | Random quip for bot |
| GET | `/api/pin-quips/:id` | admin or bot | Get one |
| POST | `/api/pin-quips` | admin | Create `{ quip }` |
| PUT | `/api/pin-quips/:id` | admin | Update |
| DELETE | `/api/pin-quips/:id` | admin | Delete |

## Trigger responses

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/trigger-responses/*` | admin or bot | List, random, triggers (bot read) |
| POST/PUT/DELETE | `/api/trigger-responses/*` | admin | CRUD on triggers, responses, pairs |

## Eight-ball responses

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/eight-ball-responses` | admin or bot | List all fortune responses |
| GET | `/api/eight-ball-responses/:id` | admin or bot | Get one |
| POST | `/api/eight-ball-responses` | admin | Create `{ response_string, sentiment }` |
| PUT | `/api/eight-ball-responses/:id` | admin | Update |
| DELETE | `/api/eight-ball-responses/:id` | admin | Delete |

## User mappings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/user-mappings?app=discord&limit=&offset=&search=` | admin, bot, or webview | Paginated list |
| GET | `/api/user-mappings/:id?app=discord` | admin or bot | Get one |
| POST | `/api/user-mappings` | admin | Create `{ app, name, handle, platformUserId }` |
| PUT | `/api/user-mappings/:id` | admin | Update |
| DELETE | `/api/user-mappings/:id?app=discord` | admin | Delete |

## Config (extended)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/config` | admin or bot | Includes `entriesWithMeta` |
| POST | `/api/config` | admin | Create key `{ config, value }` |
| PUT | `/api/config` | admin | Update existing key |
| DELETE | `/api/config/:key` | admin | Delete key |

## Pin history

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/pin-history?limit=&offset=` | admin, bot, or webview | Paginated pin log |

## System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/system/status` | admin, bot, or webview | Webapi, DB, cache version, bot heartbeat |
| GET | `/api/system/cache-version` | admin or bot | Current cache version for polling |
| POST | `/api/system/invalidate-cache` | admin | Bump cache version |
| POST | `/api/system/heartbeat` | admin or bot | `{ guildId, version, lastReadyAt? }` |

## Statistics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/statistics` | admin, bot, or webview | Aggregate row counts and usage totals across core tracking tables |

Response `statistics` object fields:

- `chatMemberMappings` — row count in `chat_member_mapping`
- `emojiCatalog` — `{ emojis, stickers, total }` from `emoji_frequency` row counts by type
- `emojiUsage` — `{ emojis, stickers, total }` from `emoji_frequency` frequency sums by type
- `pinHistory` — row count in `pin_history`
- `plusplusTracking` — row count in `plusplus_tracking`
- `triggers` — row count in `triggers`
- `responses` — row count in `responses`
- `triggerResponseFrequencySum` — sum of `frequency` in `trigger_response`
- `repostTracking` — row count in `user_repost_tracking`

## Scheduled messages (admin scope)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scheduled-messages?app=discord&scope=admin&status=pending\|sent\|all` | List all |
| PUT | `/api/scheduled-messages/:id` | Body `{ scope: "admin", app, message_body?, scheduled_at? }` |
| DELETE | `/api/scheduled-messages/:id?scope=admin&app=discord` | Admin delete |

## Events (analytics)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/events/plusplus?app=discord&from=&to=&limit=&offset=` | admin or bot | Raw plusplus events |
| GET | `/api/events/reposts?app=discord&userId=&from=&to=` | admin or bot | Raw repost events |
| GET | `/api/events/stickers?limit=` | admin | Sticker catalog |

## Leaderboards (extended)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/leaderboards/plusplus` | admin, bot, or webview | Optional `from` / `to` in body |
| POST | `/api/leaderboards/plusplus/top-voters` | admin, bot, or webview | Top voters leaderboard |
| POST | `/api/leaderboards/emoji` | admin, bot, or webview | Emoji usage leaderboard |
| POST | `/api/leaderboards/repost` | admin, bot, or webview | Optional `from` / `to` in body |
| GET | `/api/leaderboards/emoji/user/:userId?app=discord` | admin or bot | Per-user emoji stats |

## Audit log

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/audit-log?limit=&offset=` | Admin mutation audit trail |

## Authentication

- **Admin:** `ADMIN_USERNAME` / `ADMIN_PASSWORD` → JWT with `role: "admin"` (full API access)
- **Bot service account:** `BOT_USERNAME` / `BOT_PASSWORD` → JWT with `role: "bot"` (read content config; write Discord/usage data routes)
- **Web-view service account:** `WEBVIEW_USERNAME` / `WEBVIEW_PASSWORD` → JWT with `role: "webview"` (allowlisted routes only)
- Bot credentials should be used for `WEBAPI_USERNAME` / `WEBAPI_PASSWORD` in discord-bot
- Service accounts cannot `PUT` or `DELETE /api/users/me`; profiles are env-managed
- Login is rejected when no service-account usernames are configured in env

### Deployment

- **webapi** and **discord-bot** run on the internal Docker network only
- **web-view** is the sole external entry point (reverse proxy); it proxies `/api` with the webview service JWT
- CORS on webapi applies to internal browser clients (e.g. web-panel), not public internet traffic

### Web-view allowlist

The `webview` role may only access these routes:

| Method | Path |
|--------|------|
| POST | `/api/leaderboards/plusplus` |
| POST | `/api/leaderboards/plusplus/top-voters` |
| POST | `/api/leaderboards/emoji` |
| POST | `/api/leaderboards/repost` |
| GET | `/api/pin-history` |
| GET | `/api/system/status` |
| GET | `/api/statistics` |
| GET | `/api/user-mappings` |
