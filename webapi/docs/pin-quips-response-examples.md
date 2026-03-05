# Pin Quips – Response Examples

## GET /api/pin-quips

**200 OK**

```json
{
  "ok": true,
  "pinQuips": [
    { "id": 1, "quip": "Pinned for posterity.", "created_at": "2024-01-15T12:00:00.000Z" },
    { "id": 2, "quip": "This one's a keeper.", "created_at": "2024-01-15T12:05:00.000Z" }
  ]
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to list pin quips"
}
```

---

## GET /api/pin-quips/random

**200 OK**

```json
{
  "ok": true,
  "quip": "Pinned for posterity.",
  "id": 1
}
```

**404 Not Found** (no quips in database)

```json
{
  "ok": false,
  "error": "No pin quips in database"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to get random pin quip"
}
```

---

## GET /api/pin-quips/:id

**200 OK**

```json
{
  "ok": true,
  "id": 1,
  "quip": "Pinned for posterity.",
  "created_at": "2024-01-15T12:00:00.000Z"
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "Invalid id"
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Pin quip not found"
}
```

---

## POST /api/pin-quips

**201 Created**

```json
{
  "ok": true,
  "id": 3,
  "quip": "Another fine pin.",
  "created_at": "2024-01-15T13:00:00.000Z"
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "quip (non-empty string) is required"
}
```

---

## PUT /api/pin-quips/:id

**200 OK**

```json
{
  "ok": true,
  "id": 1,
  "quip": "Updated quip text.",
  "created_at": "2024-01-15T12:00:00.000Z"
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Pin quip not found"
}
```

---

## DELETE /api/pin-quips/:id

**200 OK**

```json
{
  "ok": true
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Pin quip not found"
}
```
