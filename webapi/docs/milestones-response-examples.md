# Milestones – Response Examples

## GET /api/milestones

**200 OK**

```json
{
  "ok": true,
  "milestones": [
    {
      "id": 1,
      "quantity": 100,
      "type": "pin_total",
      "item": null,
      "message": "100 pins logged!",
      "object": "pin",
      "achieved": false,
      "created_at": "2024-01-15T12:00:00.000Z",
      "updated_at": "2024-01-15T12:00:00.000Z"
    }
  ]
}
```

---

## GET /api/milestones/types

**200 OK**

```json
{
  "ok": true,
  "types": {
    "pin_total": { "itemRequired": false, "description": "Global count of pin_history rows." },
    "trigger_call_count": { "itemRequired": true, "description": "triggers.frequency after increment. item = trigger_string." }
  }
}
```

---

## GET /api/milestones/:id

**200 OK**

```json
{
  "ok": true,
  "id": 1,
  "quantity": 100,
  "type": "pin_total",
  "item": null,
  "message": "100 pins logged!",
  "object": "pin",
  "achieved": false,
  "created_at": "2024-01-15T12:00:00.000Z",
  "updated_at": "2024-01-15T12:00:00.000Z"
}
```

**404 Not Found**

```json
{ "ok": false, "error": "Milestone not found" }
```

---

## POST /api/milestones

**201 Created**

```json
{
  "ok": true,
  "id": 2,
  "quantity": 50,
  "type": "trigger_call_count",
  "item": "hello",
  "message": "hello has been triggered 50 times!",
  "object": "trigger",
  "achieved": false,
  "created_at": "2024-01-15T13:00:00.000Z",
  "updated_at": "2024-01-15T13:00:00.000Z"
}
```

**400 Bad Request**

```json
{ "ok": false, "error": "item is required for this type" }
```

```json
{ "ok": false, "error": "A milestone with this type/item/quantity already exists" }
```

---

## PUT /api/milestones/:id

**200 OK**

```json
{
  "ok": true,
  "id": 2,
  "quantity": 50,
  "type": "trigger_call_count",
  "item": "hello",
  "message": "hello has been triggered 50 times!",
  "object": "trigger",
  "achieved": true,
  "created_at": "2024-01-15T13:00:00.000Z",
  "updated_at": "2024-01-15T14:00:00.000Z"
}
```

---

## DELETE /api/milestones/:id

**200 OK**

```json
{ "ok": true }
```

**404 Not Found**

```json
{ "ok": false, "error": "Milestone not found" }
```

---

## `milestones` field on increment routes

Every increment route this feature hooks into (`POST /api/message-processing/pin-log`,
`/emoji-count`, `/sticker-count`, `/plusminus`, `/count-repost`, `GET /api/trigger-responses/random`)
gains a `milestones` array on its `200` response — empty when nothing newly crossed a threshold,
otherwise one entry per metric-crossing event:

```json
{
  "ok": true,
  "milestones": [
    { "id": 1, "quantity": 100, "message": "100 pins logged!", "type": "pin_total", "item": null }
  ]
}
```
