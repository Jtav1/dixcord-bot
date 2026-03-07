# Web API Documentation

## Complete API route index

Every route exposed by the API (auth: use `Authorization: Bearer <token>` unless marked public).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | API info and endpoint list |
| GET | `/health` | — | Health check |
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
| GET | `/api/config` | ✓ | All configuration entries |
| PUT | `/api/config` | ✓ | Update one config (body: `{ config, value }`) |
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
| GET | `/api/trigger-responses/random?trigger=` | ✓ | One random response for trigger |
| GET | `/api/trigger-responses/responses/:id` | ✓ | One response by id |
| PUT | `/api/trigger-responses/responses/:id` | ✓ | Update response text |
| DELETE | `/api/trigger-responses/responses/:id` | ✓ | Delete response |
| GET | `/api/trigger-responses/:id` | ✓ | One trigger-response link (junction) |
| POST | `/api/trigger-responses` | ✓ | Create single trigger-response pair |
| PUT | `/api/trigger-responses/:id` | ✓ | Update trigger-response link |
| DELETE | `/api/trigger-responses/:id` | ✓ | Delete trigger-response link |
| POST | `/api/leaderboards/plusplus` | ✓ | Top/bottom plusplus (body: `{ limit? }`) |
| GET | `/api/leaderboards/plusplus/total?string=&type=word or user` | ✓ | Total for word or user |
| GET | `/api/leaderboards/plusplus/voter/:userId` | ✓ | Vote count by voter |
| POST | `/api/leaderboards/plusplus/top-voters` | ✓ | Top voters (body: `{ limit? }`) |
| POST | `/api/leaderboards/emoji` | ✓ | Top emojis (body: `{ limit? }`) |
| POST | `/api/leaderboards/repost` | ✓ | Top reposters (body: `{ limit? }`) |
| GET | `/api/leaderboards/repost/user/:userId` | ✓ | Repost count for user |

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

## Request examples (cURL)

- **Trigger-Responses** sample requests: [trigger-responses-examples.md](trigger-responses-examples.md)
