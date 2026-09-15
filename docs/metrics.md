# Metrics (`GET /metrics`)

`webapi` exposes a Prometheus text-exposition endpoint at `GET /metrics`, built live on every scrape by `webapi/services/metrics.js` (`buildMetricsText()`). There is no in-process accumulation between scrapes — every gauge is either a fresh DB query or the discord-bot's latest self-reported counter snapshot.

## Auth

`/metrics` does **not** use the normal JWT auth (`authenticate`/service-account login) — JWTs are short-lived and unsuited to a static scrape config. Instead it requires a static bearer token:

- Set `METRICS_TOKEN` in `webapi/.env`.
- Prometheus scrape config must send `Authorization: Bearer <METRICS_TOKEN>`.
- If `METRICS_TOKEN` is unset, the endpoint returns `503` (disabled) rather than silently allowing unauthenticated access.
- A missing/incorrect token returns `401`.

Example scrape config:

```yaml
scrape_configs:
  - job_name: dixcord-webapi
    metrics_path: /metrics
    scheme: http
    authorization:
      credentials: <METRICS_TOKEN>
    static_configs:
      - targets: ["webapi-host:3000"]
```

## Guild-scoped vs. global gauges

The bot's config (`guild_config`) and most Discord-derived state (`guild_info`, `guild_channels`, `guild_roles`, `bot_status`) are per-`(app, guild_id)` — see the "per-server data foundation" work. `/metrics` reflects that split: **most gauges are process/DB-wide and carry no guild label, but a few are genuinely per-guild and carry a `guild_id` label.** Don't assume the whole endpoint is guild-scoped — check the label list below before writing a query.

### Per-guild gauges (`guild_id` label)

| Gauge | Labels | Meaning |
| --- | --- | --- |
| `webapi_feature_enabled` | `flag`, `guild_id` | `1`/`0` — whether a boolean config key (`plusplus_enabled`, `twitter_fix_enabled`, etc., anything typed `"boolean"` in `webapi/services/configMetadata.js`) is enabled for that guild's `guild_config`. One series per `(flag, guild_id)` pair, so a multi-guild deployment reports one full set of flags per guild. |
| `discordbot_up` | `guild_id` | `1` if the bot's last heartbeat for that guild was recent. |
| `discordbot_uptime_seconds` | `guild_id` | Seconds since that guild's bot gateway session became ready. |
| `discordbot_member_count` | `guild_id` | Guild member count as of the last heartbeat. |
| `discordbot_channel_count` | `guild_id` | Cached guild channel count as of the last heartbeat. |
| `discordbot_ws_ping_ms` | `guild_id` | Gateway heartbeat latency as of the last heartbeat. |

Since `webapi_feature_enabled` is emitted per guild, a query for a single flag across all guilds looks like:

```promql
webapi_feature_enabled{flag="twitter_fix_enabled"}
```

and to alert on a flag being off for a specific guild:

```promql
webapi_feature_enabled{flag="plusplus_enabled", guild_id="551622630516457492"} == 0
```

### Global gauges (no guild label)

Everything else is either a whole-database aggregate or whole-process status, and is **not** split by guild — there is exactly one series regardless of how many guilds exist in the DB:

- `webapi_up`, `webapi_db_up`, `webapi_uptime_seconds`, `webapi_memory_rss_bytes` — webapi process/health.
- `webapi_chat_member_mappings`, `webapi_emoji_catalog{type}`, `webapi_emoji_usage_total{type}`, `webapi_pin_history_total`, `webapi_plusplus_tracking_total`, `webapi_triggers_total`, `webapi_responses_total`, `webapi_trigger_response_frequency_total`, `webapi_repost_tracking_total`, `webapi_scheduled_messages{status}` — DB-wide row counts (`webapi/services/statistics.js`).
- `webapi_audit_log_events_total{action,resource}` — audit log activity, DB-wide.
- `webapi_guild_boost_tier`, `webapi_guild_boost_count`, `webapi_guild_channels_total`, `webapi_guild_roles_total` — currently sourced from a single `guild_info` row/`guild_channels`/`guild_roles` count with no guild filter; only meaningful for a single-guild deployment today.
- `discordbot_commands_total{command}`, `discordbot_command_errors_total{command}`, `discordbot_api_call_errors_total{module}`, and any other `discordbot_*` counter reported via the bot's heartbeat (`webapi/services/metrics.js`'s dynamic pass-through of `bot_status.metrics_json`) — these are the single discord-bot process's cumulative counters, not split by guild.

If you're running (or plan to run) more than one guild behind one webapi instance, treat any gauge without a `guild_id` label as reflecting the whole deployment, not one server.

## Adding a new gauge

When adding a metric in `webapi/services/metrics.js`:

- If the underlying data is per-`(app, guild_id)` (lives in `guild_config`, `guild_info`, `guild_channels`, `guild_roles`, `bot_status`, etc.), give the gauge a `guild_id` label and emit one series per guild — follow the `webapi_feature_enabled`/`discordbot_up` pattern, not a single unscoped value.
- If it's a DB-wide aggregate or process-level stat, no guild label is needed.
- Update the tables above so this doc stays the source of truth for which gauges are guild-scoped.
