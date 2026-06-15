# Admin Backend API Routes

Routes added for admin panel backend preparation. Unless noted, **admin role required** (bot service account receives 403).

## Eight-ball responses

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/eight-ball-responses` | List all fortune responses |
| GET | `/api/eight-ball-responses/:id` | Get one |
| POST | `/api/eight-ball-responses` | Create `{ response_string, sentiment }` |
| PUT | `/api/eight-ball-responses/:id` | Update |
| DELETE | `/api/eight-ball-responses/:id` | Delete |

## User mappings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/user-mappings?app=discord&limit=&offset=&search=` | Paginated list |
| GET | `/api/user-mappings/:id?app=discord` | Get one |
| POST | `/api/user-mappings` | Create `{ app, name, handle, platformUserId }` |
| PUT | `/api/user-mappings/:id` | Update |
| DELETE | `/api/user-mappings/:id?app=discord` | Delete |

## Config (extended)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/config` | admin or bot | Includes `entriesWithMeta` |
| POST | `/api/config` | admin | Create key `{ config, value }` |
| PUT | `/api/config` | admin | Update existing key |
| DELETE | `/api/config/:key` | admin | Delete key |

## Pin history

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pin-history?limit=&offset=` | Paginated pin log |

## System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/system/status` | admin | Webapi, DB, cache version, bot heartbeat |
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

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/events/plusplus?app=discord&from=&to=&limit=&offset=` | Raw plusplus events |
| GET | `/api/events/reposts?app=discord&userId=&from=&to=` | Raw repost events |
| GET | `/api/events/stickers?limit=` | Sticker catalog |

## Leaderboards (extended)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/leaderboards/plusplus` | Optional `from` / `to` in body |
| POST | `/api/leaderboards/repost` | Optional `from` / `to` in body |
| GET | `/api/leaderboards/emoji/user/:userId?app=discord` | Per-user emoji stats |

## Audit log

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/audit-log?limit=&offset=` | Admin mutation audit trail |

## Authentication

- **Admin:** `ADMIN_USERNAME` / `ADMIN_PASSWORD` → JWT with `role: "admin"`
- **Bot service account:** `BOT_USERNAME` / `BOT_PASSWORD` → JWT with `role: "bot"`
- Bot credentials should be used for `WEBAPI_USERNAME` / `WEBAPI_PASSWORD` in discord-bot
