# Message Processing – Response Examples

## POST /api/message-processing/emoji-count

**200 OK** (emoji counted)

```json
{
  "ok": true
}
```

**200 OK** (plus/minus applied when replying)

```json
{
  "ok": true,
  "applied": "plus"
}
```

or

```json
{
  "ok": true,
  "applied": "minus"
}
```

**200 OK** (invalid payload; no change)

```json
{
  "ok": false
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to record emoji count"
}
```

---

## POST /api/message-processing/plusminus

**200 OK** (message mode)

```json
{
  "ok": true,
  "recorded": 2
}
```

**200 OK** (reaction mode)

```json
{
  "ok": true,
  "recorded": 1,
  "value": 1
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "voterId is required"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to record plus/minus"
}
```

---

## POST /api/message-processing/count-repost

**200 OK** (accusation created)

```json
{
  "ok": true,
  "action": "created"
}
```

**200 OK** (accusation withdrawn)

```json
{
  "ok": true,
  "action": "withdrawn",
  "deleted": 1
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "userid, msgid, and accuser are required"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to record repost"
}
```

---

## POST /api/message-processing/emoji-import

**200 OK**

```json
{
  "ok": true,
  "imported": 42
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "emojis array is required"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to import emoji list"
}
```

---

## POST /api/message-processing/sticker-import

**200 OK**

```json
{
  "ok": true,
  "imported": 10
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "stickers array is required"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to import sticker list"
}
```

---

## POST /api/message-processing/pin-check

**200 OK**

```json
{
  "alreadyPinned": true
}
```

or

```json
{
  "alreadyPinned": false
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to check pin status"
}
```

---

## POST /api/message-processing/pin-log

**200 OK**

```json
{
  "ok": true
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "messageId is required"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to log pinned message"
}
```
