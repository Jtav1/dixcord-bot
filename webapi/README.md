# JavaScript Express API Template

REST API built with **Express.js** and **MySQL** or **SQLite**, using **JWT** for authentication. Ready for a front-end app or direct API access.

## Stack

- **Node.js** + **Express**
- **Database:** **MySQL** (via `mysql2`) or **SQLite** (via `better-sqlite3`)
- **JWT** (`jsonwebtoken`) + **bcryptjs** for auth
- **CORS** enabled for browser clients
- **dotenv** for config

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and set your values:

```bash
cp .env.example .env
```

Edit `.env`:

- `DB_TYPE` – `mysql` or `sqlite` (default: `mysql`)
- **If MySQL:** `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- **If SQLite:** optional `DB_FILE` (default: `data/api_template.sqlite`)
- `JWT_SECRET` – secret for signing tokens (use a long random string in production)
- `PORT` – server port (default `3000`)

### 3. Database

**Option A – MySQL**

Set `DB_TYPE=mysql` in `.env` and create the database and tables:

```bash
mysql -u root -p < sql/schema.sql
```

Or paste the contents of `sql/schema.sql` into your MySQL client.

**Option B – SQLite**

Set `DB_TYPE=sqlite` in `.env`. The app will create the database file and tables automatically on first run (using `sql/schema.sqlite.sql`). Optionally set `DB_FILE` to a custom path.

SQLite uses the optional dependency `better-sqlite3`. If you didn’t install it yet, run `npm install better-sqlite3`. On Windows, building it may require [build tools](https://github.com/nodejs/node-gyp#on-windows) or WSL; if so, you can use MySQL instead.

### 4. Run

```bash
npm start
```

Dev mode with auto-reload:

```bash
npm run dev
```

API base: `http://localhost:3000`

---

## Authentication

- **Register:** `POST /api/auth/register`  
  Body: `{ "email": "...", "password": "...", "name": "..." }`  
  Returns: `{ user, token }`

- **Login:** `POST /api/auth/login`  
  Body: `{ "email": "...", "password": "..." }`  
  Returns: `{ user, token }`

Use the token for protected routes:

```
Authorization: Bearer <your-jwt-token>
```

---

## API Endpoints

All routes except Auth require: `Authorization: Bearer <token>`.

### Auth (no token)

| Method | Path                 | Description       |
| ------ | -------------------- | ----------------- |
| POST   | `/api/auth/register` | Register new user |
| POST   | `/api/auth/login`    | Login, get JWT    |

### Users (token required)

| Method | Path            | Description                     |
| ------ | --------------- | ------------------------------- |
| GET    | `/api/users/me` | Current user profile            |
| PUT    | `/api/users/me` | Update profile (name, password) |
| DELETE | `/api/users/me` | Delete account                  |

### Bot Responses (token required)

| Method | Path                            | Description                                      |
| ------ | ------------------------------- | ------------------------------------------------ |
| POST   | `/api/bot-responses/fortune`    | Random 8-ball fortune                            |
| POST   | `/api/bot-responses/link-fixer` | Fix social links in message; body: `{ message }` |

### Message Processing (token required)

| Method | Path                                     | Description                      |
| ------ | ---------------------------------------- | -------------------------------- |
| POST   | `/api/message-processing/emoji-count`    | Emoji count                      |
| POST   | `/api/message-processing/plusminus`      | Plus/minus processing            |
| POST   | `/api/message-processing/count-repost`   | Count repost                     |
| POST   | `/api/message-processing/emoji-import`   | Emoji import                     |
| POST   | `/api/message-processing/sticker-import` | Sticker import                   |
| POST   | `/api/message-processing/pin-check`      | Pin check; body: `{ messageId }` |
| POST   | `/api/message-processing/pin-log`        | Pin log; body: `{ messageId }`   |

### Config (token required)

| Method | Path          | Description                                               |
| ------ | ------------- | --------------------------------------------------------- |
| GET    | `/api/config` | List config key/value pairs                               |
| PUT    | `/api/config` | Set config; body: `{ config, value }` (updates if exists) |

### Link Replacements (token required)

| Method | Path                         | Description                                  |
| ------ | ---------------------------- | -------------------------------------------- |
| GET    | `/api/link-replacements`     | List all link replacements                   |
| GET    | `/api/link-replacements/:id` | Get one by id                                |
| POST   | `/api/link-replacements`     | Create; body: `{ source_host, target_host }` |
| PUT    | `/api/link-replacements/:id` | Update                                       |
| DELETE | `/api/link-replacements/:id` | Delete                                       |

### Pin Quips (token required)

| Method | Path                    | Description              |
| ------ | ----------------------- | ------------------------ |
| GET    | `/api/pin-quips`        | List all pin quips       |
| GET    | `/api/pin-quips/random` | One random quip          |
| GET    | `/api/pin-quips/:id`    | Get one by id            |
| POST   | `/api/pin-quips`        | Create; body: `{ quip }` |
| PUT    | `/api/pin-quips/:id`    | Update; body: `{ quip }` |
| DELETE | `/api/pin-quips/:id`    | Delete                   |

### Trigger-Responses (token required)

Trigger-response CRUD, trigger-centric routes (triggers + responses array), and response management. **Sample requests:** see [docs/trigger-responses-examples.md](docs/trigger-responses-examples.md).

| Method | Path                                        | Description                                                                                    |
| ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/api/trigger-responses`                    | List all links (flat pairs)                                                                    |
| GET    | `/api/trigger-responses/triggers`           | List trigger strings (for bot)                                                                 |
| GET    | `/api/trigger-responses/triggers/list`      | List triggers with id, selection_mode                                                          |
| GET    | `/api/trigger-responses/triggers/responses` | All responses for trigger; query: `?trigger=` or `?triggerId=`                                 |
| GET    | `/api/trigger-responses/triggers/:id`       | Get trigger by id with responses                                                               |
| POST   | `/api/trigger-responses/triggers`           | Create trigger with responses array                                                            |
| PUT    | `/api/trigger-responses/triggers/:id`       | Update trigger / response order / add response                                                 |
| DELETE | `/api/trigger-responses/triggers/:id`       | Delete trigger; removes links and deletes only orphaned responses                              |
| GET    | `/api/trigger-responses/random`             | One random response; query: `?trigger=`                                                        |
| GET    | `/api/trigger-responses/responses/:id`      | Get response by id                                                                             |
| PUT    | `/api/trigger-responses/responses/:id`      | Update response text; body: `{ response_string }`                                              |
| DELETE | `/api/trigger-responses/responses/:id`      | Delete response                                                                                |
| GET    | `/api/trigger-responses/:id`                | Get one link by junction id                                                                    |
| POST   | `/api/trigger-responses`                    | Create one link; body: `{ trigger_string, response_string, response_order?, selection_mode? }` |
| PUT    | `/api/trigger-responses/:id`                | Update one link by junction id                                                                 |
| DELETE | `/api/trigger-responses/:id`                | Delete one link by junction id                                                                 |

### Leaderboards (token required)

| Method | Path                                       | Description                              |
| ------ | ------------------------------------------ | ---------------------------------------- | ----- |
| POST   | `/api/leaderboards/plusplus`               | Plusplus leaderboard; body: `{ limit? }` |
| GET    | `/api/leaderboards/plusplus/total`         | Query: `?string=&type=word               | user` |
| GET    | `/api/leaderboards/plusplus/voter/:userId` | Voter stats                              |
| POST   | `/api/leaderboards/plusplus/top-voters`    | Top voters; body: `{ limit? }`           |
| POST   | `/api/leaderboards/emoji`                  | Emoji leaderboard; body: `{ limit? }`    |
| POST   | `/api/leaderboards/repost`                 | Repost leaderboard; body: `{ limit? }`   |
| GET    | `/api/leaderboards/repost/user/:userId`    | Repost user stats                        |

### Other

| Method | Path      | Description                              |
| ------ | --------- | ---------------------------------------- |
| GET    | `/`       | API info and list of endpoints (no auth) |
| GET    | `/health` | Health check (no auth)                   |

---

## Example: cURL

```bash
# Login (save token from response)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-admin-password"}'

# List trigger-responses (replace TOKEN)
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/trigger-responses

# Get config
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/config
```

---

## Project layout

```
├── index.js              # Express app entry
├── config/
│   └── db.js             # DB adapter (MySQL or SQLite)
├── middleware/
│   └── auth.js           # JWT verify + sign
├── routes/
│   ├── auth.js           # login, register
│   ├── users.js          # profile CRUD
│   ├── bot-responses.js  # fortune, link-fixer
│   ├── message-processing.js
│   ├── config.js
│   ├── link-replacements.js
│   ├── pin-quips.js
│   ├── trigger-responses.js
│   └── leaderboards.js
├── services/             # Business logic
├── sql/
│   ├── schema.sql        # MySQL schema
│   └── schema.sqlite.sql # SQLite schema (auto-used when DB_TYPE=sqlite)
├── docs/
│   └── trigger-responses-examples.md  # Sample requests for trigger-response API
├── .env.example
└── package.json
```

---

## Front-end usage

- Send `Authorization: Bearer <token>` on every request to protected routes.
- Store the token (e.g. `localStorage` or memory) after login/register.
- Use any HTTP client (fetch, axios, etc.) with JSON bodies and the auth header.
