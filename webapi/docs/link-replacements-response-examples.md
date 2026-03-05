# Link Replacements – Response Examples

## GET /api/link-replacements

**200 OK**

```json
{
  "ok": true,
  "linkReplacements": [
    {
      "id": 1,
      "source_host": "twitter.com",
      "target_host": "vxtwitter.com"
    },
    {
      "id": 2,
      "source_host": "x.com",
      "target_host": "vxtwitter.com"
    }
  ]
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to list link replacements"
}
```

---

## GET /api/link-replacements/:id

**200 OK**

```json
{
  "ok": true,
  "id": 1,
  "source_host": "twitter.com",
  "target_host": "vxtwitter.com"
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
  "error": "Link replacement not found"
}
```

---

## POST /api/link-replacements

**201 Created**

```json
{
  "ok": true,
  "id": 3,
  "source_host": "tiktok.com",
  "target_host": "vxtiktok.com"
}
```

**409 Conflict** (source_host already exists)

```json
{
  "ok": false,
  "error": "A replacement for this source_host already exists"
}
```

**500 Internal Server Error**

```json
{
  "ok": false,
  "error": "Failed to create link replacement"
}
```

---

## PUT /api/link-replacements/:id

**200 OK**

```json
{
  "ok": true,
  "id": 1,
  "source_host": "twitter.com",
  "target_host": "vxtwitter.com"
}
```

**404 Not Found**

```json
{
  "ok": false,
  "error": "Link replacement not found"
}
```

**409 Conflict**

```json
{
  "ok": false,
  "error": "A replacement for this source_host already exists"
}
```

---

## DELETE /api/link-replacements/:id

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
  "error": "Link replacement not found"
}
```
