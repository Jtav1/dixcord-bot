Here is a full pass over the webapi routes, grouped by how auth is applied.

**Auth model (short):**

- \*_Public_: no JWT
- **`authenticate` only**: JWT required; role must be `admin` **or** `bot` (`NO_ROLE` is rejected)
- **`requireAdmin`** (or an inline `req.user.role !== "admin"` check): admin only

---

## Public (no JWT)

| Method | Path                              |
| ------ | --------------------------------- |
| GET    | `/`                               |
| GET    | `/health`                         |
| POST   | `/api/auth/login`                 |
| POST   | `/api/auth/register` (always 403) |

---

## Authenticated, but **not** admin-only

These use `authenticate` only (or only enforce admin for a specific mode). **Bot and admin** can call them.

### Users

| Method | Path            |
| ------ | --------------- |
| GET    | `/api/users/me` |
| PUT    | `/api/users/me` |
| DELETE | `/api/users/me` |

### Config (read only)

| Method | Path          |
| ------ | ------------- |
| GET    | `/api/config` |

### Bot responses

| Method | Path                            |
| ------ | ------------------------------- |
| POST   | `/api/bot-responses/fortune`    |
| POST   | `/api/bot-responses/link-fixer` |

### Message processing

| Method | Path                                          |
| ------ | --------------------------------------------- |
| POST   | `/api/message-processing/emoji-count`         |
| POST   | `/api/message-processing/plusminus`           |
| POST   | `/api/message-processing/count-repost`        |
| POST   | `/api/message-processing/emoji-import`        |
| POST   | `/api/message-processing/sticker-import`      |
| POST   | `/api/message-processing/user-mapping-import` |
| POST   | `/api/message-processing/pin-check`           |
| POST   | `/api/message-processing/pin-log`             |

### Link replacements (full CRUno `requireAdmin`)

| Method | Path                         |
| ------ | ---------------------------- |
| GET    | `/api/link-replacements`     |
| GET    | `/api/link-replacements/:id` |
| POST   | `/api/link-replacements`     |
| PUT    | `/api/link-replacements/:id` |
| DELETE | `/api/link-replacements/:id` |

### Pin quips (full CRUD — no `requireAdmin`)

| Method | Path                    |
| ------ | ----------------------- |
| GET    | `/api/pin-quips`        |
| GET    | `/api/pin-quips/random` |
| GET    | `/api/pin-quips/:id`    |
| POST   | `/api/pin-quips`        |
| PUT    | `/api/pin-quips/:id`    |
| DELETE | `/api/pin-quips/:id`    |

### Trigger responses (full CRUD — no `requireAdmin`)

| Method | Path                                        |
| ------ | ------------------------------------------- |
| GET    | `/api/trigger-responses`                    |
| GET    | `/api/trigger-responses/triggers`           |
| GET    | `/api/trigger-responses/triggers/list`      |
| GET    | `/api/trigger-responses/triggers/responses` |
| GET    | `/api/trigger-responses/triggers/:id`       |
| POST   | `/api/trigger-responses/triggers`           |
| PUT    | `/api/trigger-responses/triggers/:id`       |
| DELETE | `/api/trigger-responses/triggers/:id`       |
| GET    | `/api/trigger-responses/random`             |
| GET    | `/api/trigger-responses/responses/:id`      |
| PUT    | `/api/trigger-responses/responses/:id`      |
| DELETE | `/api/trigger-responses/responses/:id`      |
| GET    | `/api/trigger-responses/:id`                |
| POST   | `/api/trigger-responses`                    |
| PUT    | `/api/trigger-responses/:id`                |
| DELETE | `/api/trigger-responses/:id`                |

### Leaderboards

| Method | Path                                       |
| ------ | ------------------------------------------ |
| POST   | `/api/leaderboards/plusplus`               |
| GET    | `/api/leaderboards/plusplus/total`         |
| GET    | `/api/leaderboards/plusplus/voter/:userId` |
| POST   | `/api/leaderboards/plusplus/top-voters`    |
| POST   | `/api/leaderboards/emoji`                  |
| POST   | `/api/leaderboards/repost`                 |
| GET    | `/api/leaderboards/repost/user/:userId`    |
| GET    | `/api/leaderboards/emoji/user/:userId`     |

### System

| Method | Path                        |
| ------ | --------------------------- |
| GET    | `/api/system/cache-version` |
| POST   | `/api/system/heartbeat`     |

### Scheduled messages (route is shared; admin only for `scope=admin`)

| Method | Path                          | Non-admin modes                                                 |
| ------ | ----------------------------- | --------------------------------------------------------------- |
| GET    | `/api/scheduled-messages`     | `?scope=bot` or user scope (`?app=discord&requesterUserId=...`) |
| GET    | `/api/scheduled-messages/:id` | User-owned row (`requesterUserId` must match)                   |
| POST   | `/api/scheduled-messages`     | User create (requires `requesterUserId`)                        |
| PUT    | `/api/scheduled-messages/:id` | `{ scope: "bot", status: "sent" }` or user update               |
| DELETE | `/api/scheduled-messages/:id` | User-owned pending delete                                       |

Admin-only modes on those same handlers:

- GET with `?scope=admin`
- PUT with `{ scope: "admin", ... }`
- DELETE with `?scope=admin` or `{ scope: "admin" }`

---

## Admin-only routes (for contrast)

Everything **not** listed above under public or non-admin is admin-only:

| Area               | Routes                                                           |
| ------------------ | ---------------------------------------------------------------- |
| Config write       | `POST /api/config`, `PUT /api/config`, `DELETE /api/config/:key` |
| Eight-ball         | All `/api/eight-ball-responses` CRUD                             |
| User mappings      | All `/api/user-mappings` CRUD                                    |
| Pin history        | `GET /api/pin-history`                                           |
| System             | `GET /api/system/status`, `POST /api/system/invalidate-cache`    |
| Events             | `GET /api/events/plusplus`, `/reposts`, `/stickers`              |
| Audit log          | `GET /api/audit-log`                                             |
| Scheduled messages | Admin scope on GET/PUT/DELETE (see above)                        |

---

## Notable gaps

Several routes that look like admin-panel content management (**link replacements**, **pin quips**, **trigger responses**) only use `authenticate`, so the **bot service account can read and mutate them** today. If those should be admin-only, they would need `requireAdmin` added (or a narrower bot allowlist).

**Count:** 4 public routes + ~60 authenticated routes that do not require admin (including scheduled-message bot/user modes).
