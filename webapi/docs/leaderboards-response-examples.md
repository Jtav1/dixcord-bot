# Leaderboards – Response Examples

## POST /api/leaderboards/plusplus

**200 OK**

```json
{
  "ok": true,
  "limit": 5,
  "top": [
    { "string": "dixbot", "typestr": "user", "total": 42 },
    { "string": "cool", "typestr": "word", "total": 18 }
  ],
  "bottom": [
    { "string": "bad", "typestr": "word", "total": -5 }
  ]
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to get plusplus leaderboard"
}
```

---

## GET /api/leaderboards/plusplus/total?string=xxx&type=word|user

**200 OK**

```json
{
  "ok": true,
  "string": "dixbot",
  "type": "user",
  "total": 42
}
```

**400 Bad Request** (missing string)

```json
{
  "ok": false,
  "error": "Query parameter 'string' is required"
}
```

**400 Bad Request** (invalid type)

```json
{
  "ok": false,
  "error": "Invalid type; use 'word' or 'user'"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to get plusplus total"
}
```

---

## GET /api/leaderboards/plusplus/voter/:userId

**200 OK**

```json
{
  "ok": true,
  "voterId": "123456789012345678",
  "total": 15
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "userId is required"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to get voter count"
}
```

---

## POST /api/leaderboards/plusplus/top-voters

**200 OK**

```json
{
  "ok": true,
  "limit": 3,
  "topVoters": [
    { "voter": "111111111111111111", "total": 50 },
    { "voter": "222222222222222222", "total": 30 }
  ]
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to get top voters"
}
```

---

## POST /api/leaderboards/emoji

**200 OK**

```json
{
  "ok": true,
  "limit": 5,
  "top": [
    { "emoji": "👍", "frequency": 100, "emoid": "123", "animated": 0 },
    { "emoji": "😂", "frequency": 85, "emoid": "456", "animated": 0 }
  ]
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to get emoji leaderboard"
}
```

---

## POST /api/leaderboards/repost

**200 OK**

```json
{
  "ok": true,
  "limit": 5,
  "top": [
    { "userid": "123456789012345678", "count": 12 },
    { "userid": "987654321098765432", "count": 8 }
  ]
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to get repost leaderboard"
}
```

---

## GET /api/leaderboards/repost/user/:userId

**200 OK**

```json
{
  "ok": true,
  "userId": "123456789012345678",
  "count": 5
}
```

**400 Bad Request**

```json
{
  "ok": false,
  "error": "userId is required"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to get reposts for user"
}
```
