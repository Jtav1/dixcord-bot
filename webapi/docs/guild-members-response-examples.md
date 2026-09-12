# Guild Members – Response Examples

Per-`(app, guild_id, chat_member_mapping_id)` server membership (nickname, roles held, joined-at). The identity itself (`chat_member_mapping`) stays global/cross-server — this only tracks how that person shows up in one particular server.

## POST /api/guild-members/sync

**Request**

```json
{
  "app": "discord",
  "guildId": "710671234471559228",
  "members": [
    {
      "platformUserId": "164208106291724298",
      "nickname": "JT",
      "roles": ["612842488302141441"],
      "joinedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**200 OK**

```json
{
  "ok": true,
  "imported": 1,
  "skipped": 0
}
```

`skipped` counts entries whose `platformUserId` isn't yet known to `chat_member_mapping` — those are silently dropped rather than failing the whole sync.

**400 Bad Request** (missing `guildId`, or unsupported `app`)

```json
{
  "ok": false,
  "error": "guildId is required"
}
```

---

## GET /api/guild-members?app=discord&guildId=710671234471559228

**200 OK**

```json
{
  "ok": true,
  "members": [
    {
      "id": 1,
      "name": "Justin flavored sauce",
      "handle": "normal_justin",
      "platformUserId": "164208106291724298",
      "nickname": "JT",
      "roles": ["612842488302141441"],
      "joinedAt": "2024-01-01 00:00:00",
      "syncedAt": "2026-09-12 07:20:48"
    }
  ]
}
```

---

## GET /api/guild-members/user/1

Every server this internal `chat_member_mapping.id` belongs to — the primitive a future cross-server feature (e.g. delivering a reminder to every server a user is in) would call.

**200 OK**

```json
{
  "ok": true,
  "servers": [
    {
      "app": "discord",
      "guildId": "710671234471559228",
      "guildName": "Dixon Cox Butte Preservation Society",
      "nickname": "JT",
      "roles": ["612842488302141441"],
      "joinedAt": "2024-01-01 00:00:00"
    }
  ]
}
```

**400 Bad Request** (invalid `chatMemberMappingId`)

```json
{
  "ok": false,
  "error": "Invalid chatMemberMappingId"
}
```
