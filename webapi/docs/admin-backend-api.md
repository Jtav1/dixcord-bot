# Admin Backend API Routes

Routes added for admin panel backend preparation. **Write** routes require admin role unless noted; **read** routes require any authenticated account (`admin` or `bot`).

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
| GET | `/api/user-mappings?app=discord&limit=&offset=&search=` | admin or bot | Paginated list |
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
- **Bot service account:** `BOT_USERNAME` / `BOT_PASSWORD` → JWT with `role: "bot"` (full API access)
- **Web-view service account:** `WEBVIEW_USERNAME` / `WEBVIEW_PASSWORD` → JWT with `role: "webview"` (allowlisted routes only)
- Bot credentials should be used for `WEBAPI_USERNAME` / `WEBAPI_PASSWORD` in discord-bot

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
