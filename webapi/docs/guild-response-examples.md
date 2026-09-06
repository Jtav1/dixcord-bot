# Guild – Response Examples

## GET /api/guild

**200 OK**

```json
{
  "ok": true,
  "guild": {
    "app": "discord",
    "guildId": "710671234471559228",
    "name": "Dixon Cox Butte Preservation Society",
    "iconUrl": "https://cdn.discordapp.com/icons/710671234471559228/abc123.png",
    "description": null,
    "ownerId": "111111111111111111",
    "boostTier": 1,
    "boostCount": 3,
    "verificationLevel": "1",
    "preferredLocale": "en-US",
    "createdAt": "2020-05-14T02:11:00.000Z"
  },
  "channels": [
    { "id": "710671234471559229", "name": "general", "type": "0", "position": 0, "parent_id": null }
  ],
  "roles": [
    { "id": "612842488302141441", "name": "Mods", "color": "#e74c3c", "position": 5, "mentionable": 0, "hoisted": 1 }
  ],
  "emojis": [
    { "emoid": "1072368151922233404", "emoji": "repost", "frequency": 42, "animated": 0, "type": "emoji" }
  ],
  "stickers": [
    { "stickerid": "999999999999999999", "name": "wave", "frequency": 3 }
  ],
  "syncedAt": "2026-09-06T12:00:00.000Z"
}
```

**404 Not Found** (nothing synced yet, or no match for the given `app`/`guildId`)

```json
{
  "ok": false,
  "error": "No guild info has been synced yet"
}
```

---

## POST /api/guild/sync

**Request**

```json
{
  "app": "discord",
  "guildId": "710671234471559228",
  "guild": {
    "id": "710671234471559228",
    "name": "Dixon Cox Butte Preservation Society",
    "iconUrl": "https://cdn.discordapp.com/icons/710671234471559228/abc123.png",
    "ownerId": "111111111111111111",
    "boostTier": 1,
    "boostCount": 3,
    "verificationLevel": "1",
    "preferredLocale": "en-US",
    "createdAt": "2020-05-14T02:11:00.000Z"
  },
  "channels": [
    { "id": "710671234471559229", "name": "general", "type": "0", "position": 0, "parentId": null }
  ],
  "roles": [
    { "id": "612842488302141441", "name": "Mods", "color": "#e74c3c", "position": 5, "mentionable": false, "hoisted": true }
  ]
}
```

**200 OK**

```json
{
  "ok": true
}
```

**400 Bad Request** (unsupported `app`, or missing `guildId`/`guild`/`channels`/`roles`)

```json
{
  "ok": false,
  "error": "Unsupported app; currently only \"discord\" is accepted."
}
```
