# Metrics (`GET /metrics`)

`webapi` exposes a Prometheus text-exposition endpoint at `GET /metrics`, built live on every scrape by `webapi/services/metrics.js` (`buildMetricsText()`). There is no in-process accumulation between scrapes — every gauge is either a fresh DB query or a self-reported counter snapshot from each currently-known bot's latest heartbeat.

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

The bot's config (`guild_config`) and most Discord-derived state (`guild_info`, `guild_channels`, `guild_roles`, `bot_status`) are per-`(app, guild_id)` — see the "per-server data foundation" work. `/metrics` reflects that split: **most gauges are process/DB-wide and carry no guild label, but a few are genuinely per-guild (and, for bot health/counters, per-app) and carry `guild_id`/`app` labels.** Don't assume the whole endpoint is guild-scoped — check the label list below before writing a query.

### Per-guild gauges (`guild_id` label)

| Gauge | Labels | Meaning |
| --- | --- | --- |
| `webapi_feature_enabled` | `flag`, `guild_id` | `1`/`0` — whether a boolean config key (`plusplus_enabled`, `twitter_fix_enabled`, etc., anything typed `"boolean"` in `webapi/services/configMetadata.js`) is enabled for that guild's `guild_config`. One series per `(flag, guild_id)` pair, so a multi-guild deployment reports one full set of flags per guild. |

### Per-app, per-guild bot health gauges (`app`, `guild_id` labels)

Every currently-known bot — `discord-bot` and `fluxer-bot` report in independently, each heartbeating its own `(app, guildId)` — gets its own labeled series, so the same deployment running both apps shows both side by side instead of one overwriting the other:

| Gauge | Labels | Meaning |
| --- | --- | --- |
| `bot_up` | `app`, `guild_id` | `1` if that app+guild's last heartbeat was recent. |
| `bot_uptime_seconds` | `app`, `guild_id` | Seconds since that app+guild's gateway session became ready. |
| `bot_member_count` | `app`, `guild_id` | Guild member count as of the last heartbeat. |
| `bot_channel_count` | `app`, `guild_id` | Cached guild channel count as of the last heartbeat. |
| `bot_ws_ping_ms` | `app`, `guild_id` | Gateway heartbeat latency as of the last heartbeat. |

Compare discord-bot vs. fluxer-bot online state for the same guild:

```promql
bot_up{guild_id="551622630516457492"}
```

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

### Per-app, per-guild bot counter gauges (`app`, `guild_id`, + breakdown labels)

`bot_<counter>_total{app, guild_id}` for every scalar key in a bot's self-reported `metrics` snapshot (`webapi/services/metrics.js`'s dynamic pass-through of `bot_status.metrics_json`, one series per currently-known `(app, guildId)` bot) — e.g. `bot_messages_processed_total`, `bot_guild_joins_total`, `bot_heartbeat_send_errors_total`. Both discord-bot and fluxer-bot report the same counter key set (`discord-bot/utilities/metrics.js` / `fluxer-bot/utilities/metrics.js`), so these are directly comparable across apps via the `app` label.

The three breakdown counters add one more label on top of `app`/`guild_id`:

| Gauge | Extra label | Source counter key |
| --- | --- | --- |
| `bot_commands_total` | `command` | `commandsTotal` |
| `bot_command_errors_total` | `command` | `commandErrorsTotal` |
| `bot_api_call_errors_total` | `module` | `apiCallErrorsTotal` |

Sum a counter across both apps for one guild:

```promql
sum(bot_commands_total{guild_id="551622630516457492"}) by (command)
```

Or compare one app's error rate against the other:

```promql
bot_heartbeat_send_errors_total{app="fluxer"}
```

If you're running (or plan to run) more than one guild behind one webapi instance, treat any gauge without a `guild_id` label as reflecting the whole deployment, not one server. Likewise, any gauge without an `app` label (everything under "Global gauges" and "Per-guild gauges" above) is not bot-specific.

## Adding a new gauge

When adding a metric in `webapi/services/metrics.js`:

- If the underlying data is per-`(app, guild_id)` bot state (comes from a bot's heartbeat/`bot_status.metrics_json`), give the gauge both `app` and `guild_id` labels and emit one series per currently-known bot — follow the `bot_up`/`bot_commands_total` pattern, not a single unscoped value or a name that bakes the app into the metric name.
- If the underlying data is per-guild but app-agnostic (lives in `guild_config`, `guild_info`, `guild_channels`, `guild_roles`, etc.), give the gauge a `guild_id` label only — follow the `webapi_feature_enabled` pattern.
- If it's a DB-wide aggregate or process-level stat, no guild/app label is needed.
- Update the tables above so this doc stays the source of truth for which gauges are guild- and/or app-scoped.
