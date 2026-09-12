# Web API Documentation

REST backend for dixcord-bot. Serves the Discord bot, admin panel (`web-panel`), and public view (`web-view`). Persists config, triggers, leaderboards, pins, and related data in **MySQL** or **SQLite**, with **JWT** auth and role-based access (`admin`, `bot`, `webview`).

App-level setup and layout also live in [`../README.md`](../README.md). Copy [`../.env.example`](../.env.example) to `.env` before running.

---

## Features overview

- **Auth & users** – Login (JWT); register disabled; profile get/update/delete. Bootstraps service accounts from env (`admin`, `bot`, `webview`).
- **Bot responses** – Random 8-ball fortunes; social link fixer.
- **Message processing** – Emoji/sticker usage, plus/minus scoring, repost tracking, pin check/log, emoji/sticker import.
- **Config** – Per-`(app, guildId)` key/value bot settings (pin threshold, emoji IDs, channels, feature on/off toggles, etc.); each server a community operates gets its own fully independent set, auto-seeded with defaults when first registered via guild sync.
- **Link replacements** – CRUD for source_host → target_host rewrite rules.
- **Pin quips** – CRUD + random quip for pin reactions.
- **Trigger–responses** – Triggers with selection modes (`random`, `ordered` round-robin, `weighted`), responses, junction links, trigger response function catalog, frequency tracking, per-user usage history. See [trigger-responses-examples.md](trigger-responses-examples.md).
- **Leaderboards** – Plusplus, emoji, and repost rankings and per-user totals.
- **Eight-ball responses** – Fortune string catalog (admin writes).
- **User mappings** – Discord member ↔ display mapping.
- **Pin history** – Paginated pin log (and shared pin file storage via `PIN_FILES_DIR`).
- **System** – Health, status, cache version / invalidate, bot heartbeat.
- **Guild** – App/guild-scoped snapshot of platform-client guild metadata, channels, roles, and the emoji/sticker catalog; pushed periodically by a platform client (discord-bot today), read by admin panel/webview.
- **Guild members** – App/guild-scoped server membership (nickname, roles held, joined-at) per `chat_member_mapping` identity; the identity itself stays global/cross-server, this just tracks per-server presentation. Includes a reverse lookup ("every server this user belongs to") for future cross-server delivery features.
- **Statistics** – Aggregate counts across tracking tables (used by web-view).
- **Scheduled messages** – Create/list/update/delete reminders for bot delivery; admin scope for moderation.
- **Events & audit** – Raw plusplus/repost events; admin audit log.
- **Ops** – CORS allowlist, rate limits, optional password sync for service accounts on boot.

---

## Environment variables

| Variable | Default / notes | Description |
| -------- | --------------- | ----------- |
| `PORT` | `3000` | HTTP listen port |
| `NODE_ENV` | — | `development` / `production` (affects some setup scripts) |
| `DB_TYPE` | `mysql` in code; example uses `sqlite` | `mysql` or `sqlite` |
| `DB_HOST` | `localhost` | MySQL host (`DB_TYPE=mysql`) |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | empty | MySQL password |
| `DB_NAME` | `api_template` | MySQL database name |
| `DB_FILE` | `data/api_template.sqlite` | SQLite file path (`DB_TYPE=sqlite`) |
| `JWT_SECRET` | **required** | Signing secret; must be set (non-empty) |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `ADMIN_USERNAME` | **required** | Admin panel login email (created/updated on boot) |
| `ADMIN_PASSWORD` | **required** | Admin password |
| `BOT_USERNAME` | **required** | Discord bot service account email (use as bot `WEBAPI_USERNAME`) |
| `BOT_PASSWORD` | **required** | Bot service account password |
| `WEBVIEW_USERNAME` | **required** | Public web-view service account email |
| `WEBVIEW_PASSWORD` | **required** | Web-view service account password |
| `SYNC_SERVICE_PASSWORDS` | unset / false | `true` → overwrite service-account passwords from env on every boot; otherwise only on create |
| `CORS_ORIGINS` | legacy defaults if unset | Comma-separated hostnames or full origins allowed for CORS |
| `API_RATE_LIMIT_MAX` | `300` | Authenticated API requests per minute per IP |
| `PIN_FILES_DIR` | `../discord-bot/files` | Shared directory for pin attachment files |
| `DISCORD_GUILD_ID` | unset | Dev-only: guild to seed `guild_config` for on first boot (see below) |
| `SEED_CONFIG_<KEY>` | unset | Dev-only: value for `guild_config`'s `<key>` (uppercased) when seeding on first boot |

Service usernames (`ADMIN_USERNAME`, `BOT_USERNAME`, `WEBVIEW_USERNAME`) must be set or the process refuses to start cleanly for those accounts.

On boot, if `NODE_ENV != production`, `DISCORD_GUILD_ID` is set, and `guild_config` has zero rows anywhere (true first launch, not per-guild), webapi seeds `guild_config` for that guild from any `SEED_CONFIG_<KEY>` env vars present (falling back to each key's `defaultValue` from `services/configMetadata.js` for the rest). This never runs again once `guild_config` has any rows.

---

## Complete API route index

Every route exposed by the API (auth: use `Authorization: Bearer <token>` unless marked public).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | API info and endpoint list |
| GET | `/health` | — | Health check |
| GET | `/metrics` | `METRICS_TOKEN` bearer | Prometheus exposition format (plain text, not the JSON envelope); 503 if `METRICS_TOKEN` unset |
| POST | `/api/auth/login` | public | Admin login; returns JWT |
| POST | `/api/auth/register` | public | Disabled (403) |
| GET | `/api/users/me` | ✓ | Current user profile |
| PUT | `/api/users/me` | ✓ | Update profile (name, password) |
| DELETE | `/api/users/me` | ✓ | Delete account |
| POST | `/api/bot-responses/fortune` | ✓ | Random 8-ball fortune |
| POST | `/api/bot-responses/link-fixer` | ✓ | Fix embed-friendly link (body: `{ message }`) |
| POST | `/api/message-processing/emoji-count` | ✓ | Record emoji usage / +/- reply |
| POST | `/api/message-processing/plusminus` | ✓ | Record plus/minus (message or reaction) |
| POST | `/api/message-processing/count-repost` | ✓ | Record or withdraw repost accusation |
| POST | `/api/message-processing/emoji-import` | ✓ | Sync server emoji list |
| POST | `/api/message-processing/sticker-import` | ✓ | Sync server sticker list |
| POST | `/api/message-processing/pin-check` | ✓ | Check if message already pinned (body: `{ messageId }`) |
| POST | `/api/message-processing/pin-log` | ✓ | Log message as pinned (body: `{ messageId }`) |
| GET | `/api/config?app=&guildId=` | ✓ | All configuration entries for one server (includes `entriesWithMeta`) |
| POST | `/api/config` | admin | Create config key for a server (body: `{ app, guildId, config, value }`) |
| PUT | `/api/config` | admin | Update one config for a server (body: `{ app, guildId, config, value }`) |
| DELETE | `/api/config/:key?app=&guildId=` | admin | Delete config key for a server |
| GET | `/api/link-replacements` | ✓ | List all link replacements |
| GET | `/api/link-replacements/:id` | ✓ | Get one link replacement |
| POST | `/api/link-replacements` | ✓ | Create (body: `{ source_host, target_host }`) |
| PUT | `/api/link-replacements/:id` | ✓ | Update |
| DELETE | `/api/link-replacements/:id` | ✓ | Delete |
| GET | `/api/pin-quips` | ✓ | List all pin quips |
| GET | `/api/pin-quips/random` | ✓ | One random pin quip |
| GET | `/api/pin-quips/:id` | ✓ | Get one pin quip |
| POST | `/api/pin-quips` | ✓ | Create (body: `{ quip }`) |
| PUT | `/api/pin-quips/:id` | ✓ | Update (body: `{ quip }`) |
| DELETE | `/api/pin-quips/:id` | ✓ | Delete |
| GET | `/api/trigger-responses` | ✓ | List all trigger-response pairs (flat) |
| GET | `/api/trigger-responses/triggers` | ✓ | List unique trigger strings |
| GET | `/api/trigger-responses/triggers/list` | ✓ | List triggers with id, selection_mode |
| GET | `/api/trigger-responses/triggers/responses?trigger=` or `?triggerId=` | ✓ | All responses for a trigger |
| GET | `/api/trigger-responses/triggers/:id` | ✓ | One trigger with responses |
| POST | `/api/trigger-responses/triggers` | ✓ | Create trigger + responses |
| PUT | `/api/trigger-responses/triggers/:id` | ✓ | Update trigger / responses |
| GET | `/api/trigger-responses/random?trigger=&app=&userId=` | ✓ | One response for trigger (mode-aware); app+userId optionally logs trigger_response_user_history |
| GET | `/api/trigger-responses/functions` | ✓ | Trigger response function catalog |
| GET | `/api/trigger-responses/history/users?app=` | ✓ | Users with at least one trigger-response history entry |
| GET | `/api/trigger-responses/history/:chatMemberId?limit=&offset=` | ✓ | Paginated trigger-response usage history for one user |
| GET | `/api/trigger-responses/responses/:id` | ✓ | One response by id |
| PUT | `/api/trigger-responses/responses/:id` | ✓ | Update response text |
| DELETE | `/api/trigger-responses/responses/:id` | ✓ | Delete response |
| GET | `/api/trigger-responses/:id` | ✓ | One trigger-response link (junction) |
| POST | `/api/trigger-responses` | ✓ | Create single trigger-response pair |
| PUT | `/api/trigger-responses/:id` | ✓ | Update trigger-response link |
| PATCH | `/api/trigger-responses/:id/parameters` | ✓ | Set/clear a link's response_function_parameters |
| DELETE | `/api/trigger-responses/:id` | ✓ | Delete trigger-response link |
| POST | `/api/leaderboards/plusplus` | ✓ | Top/bottom plusplus (body: `{ limit? }`) |
| GET | `/api/leaderboards/plusplus/total?string=&type=word or user` | ✓ | Total for word or user |
| GET | `/api/leaderboards/plusplus/voter/:userId` | ✓ | Vote count by voter |
| POST | `/api/leaderboards/plusplus/top-voters` | ✓ | Top voters (body: `{ limit? }`) |
| POST | `/api/leaderboards/emoji` | ✓ | Top emojis (body: `{ limit? }`) |
| POST | `/api/leaderboards/repost` | ✓ | Top reposters (body: `{ limit? }`) |
| GET | `/api/leaderboards/repost/user/:userId` | ✓ | Repost count for user |
| GET | `/api/leaderboards/emoji/user/:userId?app=discord` | ✓ | Per-user emoji stats |
| GET | `/api/eight-ball-responses` | ✓ | List eight-ball responses |
| POST | `/api/eight-ball-responses` | admin | Create eight-ball response |
| GET | `/api/user-mappings?app=discord` | ✓ | List user mappings |
| GET | `/api/pin-history` | ✓ | Pin history log |
| GET | `/api/statistics` | ✓ | Aggregate usage statistics |
| GET | `/api/system/status?app=&guildId=` | ✓ | System and bot status; `status.bot` scoped to one server when both params given, else most-recently-seen; `status.bots` always lists every known server |
| GET | `/api/system/cache-version` | ✓ | Cache version for bot polling |
| POST | `/api/system/invalidate-cache` | admin | Bump cache version |
| POST | `/api/system/heartbeat` | ✓ | Bot heartbeat (body: `{ app, guildId, version }`) |
| GET | `/api/guild?app=&guildId=` | ✓ | Synced guild metadata, channels, roles, emoji/sticker catalog |
| POST | `/api/guild/sync` | ✓ | Push a full guild snapshot (body: `{ app, guildId, guild, channels, roles }`); auto-seeds default config for brand-new servers |
| GET | `/api/guild-members?app=&guildId=` | ✓ | List one server's members (joined with chat_member_mapping) |
| GET | `/api/guild-members/user/:chatMemberMappingId` | ✓ | Every server a given internal user id belongs to |
| POST | `/api/guild-members/sync` | ✓ | Push a full server membership list (body: `{ app, guildId, members }`) |
| GET | `/api/events/plusplus` | ✓ | Raw plusplus events |
| GET | `/api/events/reposts` | ✓ | Raw repost events |
| GET | `/api/audit-log` | admin | Audit log |
| GET | `/api/scheduled-messages?scope=admin` | admin | All scheduled messages |

See [admin-backend-api.md](admin-backend-api.md) for full admin route documentation.

## Scheduled messages

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/scheduled-messages?app=discord&scope=bot&due=` | ✓ | Pending rows for bot scheduler; `due=true` filters to only currently-due rows |
| GET | `/api/scheduled-messages?app=discord&scope=admin&status=` | admin | Admin list (pending/sent/all) |
| GET | `/api/scheduled-messages/:id` | ✓ | Get one (requester-owned) |
| POST | `/api/scheduled-messages` | ✓ | Create scheduled message |
| PUT | `/api/scheduled-messages/:id` | ✓ | User/bot/admin update |
| DELETE | `/api/scheduled-messages/:id` | ✓ | User or admin delete |
| POST | `/api/scheduled-messages/parse-reminder` | ✓ | Parse "remind me" text into a scheduled time + message body |
| POST | `/api/scheduled-messages/parse-time` | ✓ | Parse a bare time expression (no "remind me" grammar) into a scheduled time |

## Response examples by route category

Example JSON responses for each API route category:

| Category | File | Description |
|----------|------|-------------|
| **Root & Health** | [root-and-health.md](root-and-health.md) | GET `/`, GET `/health` |
| **Auth** | [auth-response-examples.md](auth-response-examples.md) | Login, register (403 when disabled) |
| **Users** | [users-response-examples.md](users-response-examples.md) | Profile get/update/delete |
| **Bot Responses** | [bot-responses-response-examples.md](bot-responses-response-examples.md) | Fortune, link-fixer |
| **Message Processing** | [message-processing-response-examples.md](message-processing-response-examples.md) | Emoji count, plusminus, repost, import, pin |
| **Config** | [config-response-examples.md](config-response-examples.md) | Get/put configuration |
| **Link Replacements** | [link-replacements-response-examples.md](link-replacements-response-examples.md) | CRUD for source_host → target_host |
| **Pin Quips** | [pin-quips-response-examples.md](pin-quips-response-examples.md) | List, random, CRUD |
| **Trigger-Responses** | [trigger-responses-response-examples.md](trigger-responses-response-examples.md) | Triggers, responses, links, random |
| **Leaderboards** | [leaderboards-response-examples.md](leaderboards-response-examples.md) | Plusplus, emoji, repost |
| **Admin backend** | [admin-backend-api.md](admin-backend-api.md) | New admin-panel backend routes |
| **Guild** | [guild-response-examples.md](guild-response-examples.md) | Guild metadata, channels, roles, emoji/sticker catalog |
| **Guild Members** | [guild-members-response-examples.md](guild-members-response-examples.md) | Per-server membership sync/list, reverse user→servers lookup |

## Request examples (cURL)

- **Trigger-Responses** sample requests: [trigger-responses-examples.md](trigger-responses-examples.md)
