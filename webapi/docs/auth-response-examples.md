# Auth – Response Examples

## POST /api/auth/register

**403 Forbidden** (registration disabled)

```json
{
  "ok": false,
  "error": "Registration is disabled"
}
```

---

## POST /api/auth/login

**200 OK** (success)

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin",
    "created_at": "2024-01-15T12:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**400 Bad Request** (missing credentials)

```json
{
  "ok": false,
  "error": "Email and password are required"
}
```

**401 Unauthorized** (invalid credentials)

```json
{
  "ok": false,
  "error": "Invalid email or password"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Login failed"
}
```
