# Deployment

## 1. Overview / architecture

Services: `webapi` (shared backend), `discord-bot` and `fluxer-bot` (chat clients, both depend on `webapi`), `webview` (public read-only site), `webadmin` (admin panel). See root `docker-compose.yml`.

## 2. TLS (external, not included in this stack)

Reverse proxy info for webview and webapi here

## 3. Quick start (production)

## 4. Secrets checklist

## 5. Network exposure

## 6. CORS configuration

## 7. Monitoring

See [`metrics.md`](metrics.md) for the `GET /metrics` Prometheus endpoint: auth (`METRICS_TOKEN`), scrape config, and which gauges are per-guild vs. deployment-wide.