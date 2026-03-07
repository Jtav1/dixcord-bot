# Root & Health – Response Examples

Public endpoints (no authentication). Rate limited.

---

## GET /

**200 OK** – API info and endpoint list

```json
{
  "name": "js-express-api-template",
  "version": "1.0.0",
  "endpoints": {
    "auth": {
      "public": [
        "POST /api/auth/login (admin only; returns JWT)",
        "POST /api/auth/register (disabled; returns 403)"
      ]
    },
    "users": {
      "authRequired": true,
      "routes": [
        "GET /api/users/me",
        "PUT /api/users/me",
        "DELETE /api/users/me"
      ]
    },
    "botResponses": { "authRequired": true, "routes": [...] },
    "messageProcessing": { "authRequired": true, "routes": [...] },
    "config": { "authRequired": true, "routes": [...] },
    "linkReplacements": { "authRequired": true, "routes": [...] },
    "pinQuips": { "authRequired": true, "routes": [...] },
    "triggerResponses": { "authRequired": true, "routes": [...] },
    "leaderboards": { "authRequired": true, "routes": [...] }
  },
  "auth": "Use header: Authorization: Bearer <token>"
}
```

---

## GET /health

**200 OK** – Health check

```json
{
  "status": "ok"
}
```
