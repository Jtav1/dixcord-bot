# Users – Response Examples

## GET /api/users/me

**200 OK**

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "name": "Admin"
  }
}
```

---

## PUT /api/users/me

**200 OK**

```json
{
  "ok": true,
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "name": "Updated Name",
    "created_at": "2024-01-15T12:00:00.000Z"
  }
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "No valid fields to update"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Update failed"
}
```

---

## DELETE /api/users/me

**200 OK**

```json
{
  "ok": true
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Delete failed"
}
```
