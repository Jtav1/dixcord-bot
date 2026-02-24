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

### Auth (no token)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get JWT |

### Users (token required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/me` | Current user profile |
| PUT | `/api/users/me` | Update profile (name, password) |
| DELETE | `/api/users/me` | Delete account |

### Posts (token required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/posts` | List current user's posts |
| GET | `/api/posts/:id` | Get one post |
| POST | `/api/posts` | Create post `{ title, body? }` |
| PUT | `/api/posts/:id` | Update post |
| DELETE | `/api/posts/:id` | Delete post |

### Tasks (token required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List current user's tasks |
| GET | `/api/tasks/:id` | Get one task |
| POST | `/api/tasks` | Create task `{ title, completed? }` |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |

---

## Example: cURL

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123","name":"You"}'

# Login (save token from response)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}'

# Create a post (replace TOKEN)
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"title":"My first post","body":"Hello world"}'

# List posts
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/posts
```

---

## Project layout

```
├── index.js           # Express app entry
├── config/
│   └── db.js          # DB adapter (MySQL or SQLite)
├── middleware/
│   └── auth.js        # JWT verify + sign
├── routes/
│   ├── auth.js        # register, login
│   ├── users.js       # profile CRUD
│   ├── posts.js       # posts CRUD
│   └── tasks.js       # tasks CRUD
├── sql/
│   ├── schema.sql     # MySQL schema
│   └── schema.sqlite.sql  # SQLite schema (auto-used when DB_TYPE=sqlite)
├── .env.example
└── package.json
```

---

## Front-end usage

- Send `Authorization: Bearer <token>` on every request to protected routes.
- Store the token (e.g. `localStorage` or memory) after login/register.
- Use any HTTP client (fetch, axios, etc.) with JSON bodies and the auth header.
