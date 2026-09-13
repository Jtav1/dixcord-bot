import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { apiReference } from "@scalar/express-api-reference";
import db from "./config/db.js";
import { ensureSchemaMigrations } from "./scripts/ensureSchema.js";
import { guildConfigIsEmpty, seedDefaultConfigForGuild } from "./services/guildConfig.js";
import { CONFIG_METADATA } from "./services/configMetadata.js";
import { buildOpenApiSpec } from "./lib/openapi.js";
import { buildMetricsText } from "./services/metrics.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import botResponsesRoutes from "./routes/bot-responses.js";
import messageProcessingRoutes from "./routes/message-processing.js";
import configRoutes from "./routes/config.js";
import linkReplacementsRoutes from "./routes/link-replacements.js";
import leaderboardsRoutes from "./routes/leaderboards.js";
import pinQuipsRoutes from "./routes/pin-quips.js";
import triggerResponsesRoutes from "./routes/trigger-responses.js";
import scheduledMessagesRoutes from "./routes/scheduled-messages.js";
import eightBallResponsesRoutes from "./routes/eight-ball-responses.js";
import userMappingsRoutes from "./routes/user-mappings.js";
import pinHistoryRoutes from "./routes/pin-history.js";
import systemRoutes from "./routes/system.js";
import eventsRoutes from "./routes/events.js";
import auditLogRoutes from "./routes/audit-log.js";
import statisticsRoutes from "./routes/statistics.js";
import guildRoutes from "./routes/guild.js";
import guildMembersRoutes from "./routes/guild-members.js";
import serviceAccountsRoutes from "./routes/service-accounts.js";

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = "v2.2";
const syncServicePasswords =
  String(process.env.SYNC_SERVICE_PASSWORDS || "").toLowerCase() === "true";

/**
 * Create or update a service account user row.
 * Password is set on create; existing rows only sync password when SYNC_SERVICE_PASSWORDS=true.
 * Role is always enforced on existing rows...
 * @param {string} email Service account email.
 * @param {string} password Plain-text password from env.
 * @param {string} name Display name.
 * @param {string} role Account role.
 * @param {string} label Log label (e.g. "Admin user").
 * @returns {Promise<void>}
 */
async function ensureServiceUser(email, password, name, role, label) {
  const [rows] = await db.query(
    "SELECT id, password_hash FROM users WHERE email = ?",
    [email],
  );
  if (rows && rows.length > 0) {
    if (syncServicePasswords) {
      const hash = await bcrypt.hash(password, 10);
      await db.query(
        "UPDATE users SET password_hash = ?, role = ? WHERE email = ?",
        [hash, role, email],
      );
      console.log(`webapi: ${label} password updated.`);
    } else {
      await db.query("UPDATE users SET role = ? WHERE email = ?", [
        role,
        email,
      ]);
    }
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  await db.query(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
    [email, hash, name, role],
  );
  console.log(`webapi: ${label} created.`);
}

/**
 * Create or update the admin user from ADMIN_USERNAME and ADMIN_PASSWORD.
 * @returns {Promise<void>}
 */
async function ensureAdminUser() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.log(
      "webapi: ADMIN_USERNAME and ADMIN_PASSWORD must be set; no admin user created.",
    );
    return;
  }
  try {
    await ensureServiceUser(username, password, "Admin", "admin", "Admin user");
  } catch (err) {
    console.error("Failed to ensure admin user:", err);
    throw err;
  }
}

/**
 * Create or update the bot service account from BOT_USERNAME and BOT_PASSWORD.
 * @returns {Promise<void>}
 */
async function ensureBotUser() {
  const username = process.env.BOT_USERNAME;
  const password = process.env.BOT_PASSWORD;
  if (!username || !password) {
    console.log(
      "webapi: BOT_USERNAME and BOT_PASSWORD not set; bot service account not created.",
    );
    return;
  }
  try {
    await ensureServiceUser(
      username,
      password,
      "Bot",
      "bot",
      "Bot service account",
    );
  } catch (err) {
    console.error("webapi: Failed to ensure bot user:", err);
    throw err;
  }
}

/**
 * Create or update the web-view service account from WEBVIEW_USERNAME and WEBVIEW_PASSWORD.
 * @returns {Promise<void>}
 */
async function ensureWebViewUser() {
  const username = process.env.WEBVIEW_USERNAME;
  const password = process.env.WEBVIEW_PASSWORD;
  if (!username || !password) {
    console.warn(
      "WEBVIEW_USERNAME and WEBVIEW_PASSWORD not set; web-view service account not created.",
    );
    return;
  }
  try {
    await ensureServiceUser(
      username,
      password,
      "webview",
      "webview",
      "Web-view service account",
    );
  } catch (err) {
    console.error("Failed to ensure web-view user:", err);
    throw err;
  }
}

/**
 * Dev convenience: seed guild_config for DISCORD_GUILD_ID from SEED_CONFIG_* env values.
 * Skipped in production and whenever guild_config already has any rows (not just first launch).
 * @returns {Promise<void>}
 */
async function seedDevGuildConfig() {
  if (process.env.NODE_ENV === "production") return;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return;
  if (!(await guildConfigIsEmpty())) return;
  const overrides = Object.keys(CONFIG_METADATA)
    .map((config) => ({ config, envValue: process.env[`SEED_CONFIG_${config.toUpperCase()}`] }))
    .filter(({ envValue }) => envValue !== undefined)
    .map(({ config, envValue }) => ({ config, value: envValue }));
  if (overrides.length === 0) return;
  await seedDefaultConfigForGuild("discord", guildId, overrides);
  console.log(`webapi: dev-seeded guild_config for discord/${guildId} from SEED_CONFIG_* env vars`);
}

/**
 * Parse CORS_ORIGINS env (comma-separated) or fall back to legacy defaults.
 * @returns {Set<string>}
 */
function parseCorsOrigins() {
  const envOrigins = process.env.CORS_ORIGINS;
  if (envOrigins && envOrigins.trim()) {
    return new Set(
      envOrigins
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    );
  }
  return new Set(["192.168.0.2", "dixbot-discord"]);
}

const corsOrigins = parseCorsOrigins();

if (corsOrigins.has("*")) {
  console.warn(
    "webapi: CORS_ORIGINS includes '*'; restrict origins in production deployments.",
  );
}

if (
  !process.env.ADMIN_USERNAME ||
  !process.env.BOT_USERNAME ||
  !process.env.WEBVIEW_USERNAME
) {
  console.warn(
    "webapi: One or more service account usernames are unset; login allowlist may reject all requests.",
  );
}

/**
 * Check whether an origin is allowed for CORS.
 * @param {string|undefined} origin
 * @returns {boolean}
 */
function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (corsOrigins.has(host) || corsOrigins.has(origin)) return true;
    if (corsOrigins.has("*")) return true;
    const m = host.match(/^172\.21\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      if (a >= 0 && a <= 255 && b >= 0 && b <= 255) return true;
    }
    return false;
  } catch {
    return false;
  }
}

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      if (isAllowedOrigin(origin)) return cb(null, true);
      cb(null, false);
    },
  }),
);
app.use(express.json({ limit: "100kb" }));

const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { ok: false, error: "Too many requests, try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { ok: false, error: "Too many login attempts, try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT_MAX || "300", 10),
  message: { ok: false, error: "Too many requests, try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @openapi
 * /:
 *   get:
 *     operationId: getApiInfo
 *     tags: [System]
 *     summary: API info and endpoint list
 *     security: []
 *     responses:
 *       '200':
 *         description: Service name, version, and a human-readable endpoint index.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name: { type: string, example: dixcord-webapi }
 *                 version: { type: string, example: v2.2 }
 *                 endpoints: { type: object, description: "Nested map of resource -> route descriptions." }
 *                 auth: { type: string, example: "Use header: Authorization: Bearer <token>" }
 */
app.get("/", publicLimiter, (req, res) => {
  res.json({
    name: "dixcord-webapi",
    version: API_VERSION,
    endpoints: {
      auth: {
        public: [
          "POST /api/auth/login (admin, bot, or webview service account; returns JWT)",
          "POST /api/auth/register (disabled; returns 403)",
        ],
      },
      users: {
        authRequired: true,
        routes: [
          "GET /api/users/me",
          "PUT /api/users/me",
          "DELETE /api/users/me",
        ],
      },
      config: {
        authRequired: true,
        adminRoutes: [
          "GET /api/config?app=&guildId= (includes entriesWithMeta, per-server)",
          "POST /api/config (body: { app, guildId, config, value })",
          "PUT /api/config (body: { app, guildId, config, value })",
          "DELETE /api/config/:key?app=&guildId=",
        ],
      },
      eightBallResponses: {
        authRequired: true,
        routes: [
          "GET /api/eight-ball-responses",
          "GET /api/eight-ball-responses/:id",
        ],
        adminRoutes: [
          "POST /api/eight-ball-responses",
          "PUT /api/eight-ball-responses/:id",
          "DELETE /api/eight-ball-responses/:id",
        ],
      },
      userMappings: {
        authRequired: true,
        routes: [
          "GET /api/user-mappings?app=discord",
          "GET /api/user-mappings/:id?app=discord",
        ],
        adminRoutes: [
          "POST /api/user-mappings",
          "PUT /api/user-mappings/:id",
          "DELETE /api/user-mappings/:id?app=discord",
        ],
      },
      pinHistory: {
        authRequired: true,
        routes: [
          "GET /api/pin-history?limit=&offset=",
          "GET /api/pin-history/incomplete?limit=&offset=",
          "GET /api/pin-history/:id",
          "PUT /api/pin-history/:id",
        ],
      },
      system: {
        authRequired: true,
        routes: [
          "GET /api/system/status?app=&guildId= (admin, bot, or webview)",
          "GET /api/system/cache-version",
          "POST /api/system/invalidate-cache (admin)",
          "POST /api/system/heartbeat (body: { app?, guildId, version })",
        ],
      },
      statistics: {
        authRequired: true,
        routes: ["GET /api/statistics (admin, bot, or webview)"],
      },
      events: {
        authRequired: true,
        routes: [
          "GET /api/events/plusplus?app=discord&from=&to=",
          "GET /api/events/reposts?app=discord&userId=",
        ],
        adminRoutes: ["GET /api/events/stickers"],
      },
      auditLog: {
        authRequired: true,
        adminRoutes: ["GET /api/audit-log?limit=&offset="],
      },
      guild: {
        authRequired: true,
        routes: [
          "GET /api/guild?app=&guildId=",
          "POST /api/guild/sync (body: { app, guildId, guild, channels, roles })",
        ],
      },
      guildMembers: {
        authRequired: true,
        routes: [
          "GET /api/guild-members?app=&guildId= (guildId optional: omit for all-guilds dedup lookup)",
          "GET /api/guild-members/user/:chatMemberMappingId",
          "POST /api/guild-members/sync (body: { app, guildId, members }); upserts, never removes members",
        ],
        adminRoutes: ["GET /api/guild-members/unlinked?app=&guildId="],
      },
      serviceAccounts: {
        authRequired: true,
        adminRoutes: [
          "GET /api/service-accounts?role=&guildId=",
          "POST /api/service-accounts (body: { email, password, name, role, guildId? })",
          "DELETE /api/service-accounts/:id",
        ],
      },
      botResponses: {
        authRequired: true,
        routes: [
          "POST /api/bot-responses/fortune",
          "POST /api/bot-responses/link-fixer (body: { message })",
        ],
      },
      messageProcessing: {
        authRequired: true,
        routes: [
          "POST /api/message-processing/emoji-count",
          "POST /api/message-processing/plusminus",
          "POST /api/message-processing/count-repost",
          "POST /api/message-processing/emoji-import",
          "POST /api/message-processing/sticker-import",
          "POST /api/message-processing/pin-check",
          "POST /api/message-processing/pin-log",
        ],
      },
      linkReplacements: {
        authRequired: true,
        routes: ["GET/POST/PUT/DELETE /api/link-replacements"],
      },
      pinQuips: {
        authRequired: true,
        routes: [
          "GET/POST/PUT/DELETE /api/pin-quips",
          "GET /api/pin-quips/random",
        ],
      },
      triggerResponses: {
        authRequired: true,
        routes: ["Full CRUD under /api/trigger-responses/*"],
      },
      scheduledMessages: {
        authRequired: true,
        routes: [
          "GET /api/scheduled-messages?app=discord&scope=bot|admin&status=",
          "GET/POST/PUT/DELETE /api/scheduled-messages/:id",
          "POST /api/scheduled-messages/parse-reminder",
        ],
      },
      leaderboards: {
        authRequired: true,
        routes: [
          "POST /api/leaderboards/plusplus (optional from/to)",
          "POST /api/leaderboards/repost (optional from/to)",
          "GET /api/leaderboards/emoji/user/:userId?app=discord",
          "Other plusplus/emoji/repost routes",
        ],
      },
    },
    auth: "Use header: Authorization: Bearer <token>",
  });
});

/**
 * @openapi
 * /health:
 *   get:
 *     operationId: getHealth
 *     tags: [System]
 *     summary: Health check
 *     security: []
 *     responses:
 *       '200':
 *         description: Service is up.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [ok] }
 */
app.get("/health", publicLimiter, (req, res) => res.json({ status: "ok" }));

/**
 * Reject unless the request carries the shared METRICS_TOKEN as a bearer token. Not the same as
 * authenticate() (JWTs are short-lived and unsuitable for a static Prometheus scrape config).
 */
function requireMetricsToken(req, res, next) {
  const token = process.env.METRICS_TOKEN;
  if (!token) {
    console.warn("webapi: METRICS_TOKEN not set; /metrics is disabled.");
    return res
      .status(503)
      .json({ ok: false, error: "Metrics endpoint not configured" });
  }
  if (req.headers.authorization !== `Bearer ${token}`) {
    return res
      .status(401)
      .json({ ok: false, error: "Invalid or missing metrics token" });
  }
  next();
}

/**
 * @openapi
 * /metrics:
 *   get:
 *     operationId: getMetrics
 *     tags: [System]
 *     summary: Prometheus metrics exposition
 *     description: >
 *       Requires a `METRICS_TOKEN` bearer token (set via the METRICS_TOKEN env var), not a JWT -
 *       intended for a static Prometheus scrape_config, not interactive API clients. Returns 503
 *       if METRICS_TOKEN is unset.
 *     security: []
 *     responses:
 *       '200':
 *         description: Prometheus text exposition format.
 *         content:
 *           text/plain:
 *             schema: { type: string }
 *       '401':
 *         description: Missing or invalid metrics token.
 *       '503':
 *         description: METRICS_TOKEN not configured.
 */
app.get("/metrics", publicLimiter, requireMetricsToken, async (req, res) => {
  try {
    const { text, contentType } = await buildMetricsText();
    res.set("Content-Type", contentType);
    res.send(text);
  } catch (err) {
    console.error("GET /metrics error:", err);
    res.status(500).send("Failed to build metrics");
  }
});

const openApiSpec = buildOpenApiSpec();

/**
 * @openapi
 * /openapi.json:
 *   get:
 *     operationId: getOpenApiSpec
 *     tags: [System]
 *     summary: OpenAPI 3.0 document for this API
 *     security: []
 *     responses:
 *       '200':
 *         description: The generated OpenAPI document (built from `@openapi` JSDoc in routes/*.js).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
app.get("/openapi.json", publicLimiter, (req, res) => res.json(openApiSpec));

app.get(
  "/docs",
  publicLimiter,
  (req, res, next) => {
    res.removeHeader("Content-Security-Policy");
    next();
  },
  apiReference({
    url: "/openapi.json",
    pageTitle: "dixcord-bot webapi",
    agent: {
      disabled: true,
    },
  }),
);

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", apiLimiter);
app.use("/api/users", userRoutes);
app.use("/api/bot-responses", botResponsesRoutes);
app.use("/api/message-processing", messageProcessingRoutes);
app.use("/api/config", configRoutes);
app.use("/api/link-replacements", linkReplacementsRoutes);
app.use("/api/pin-quips", pinQuipsRoutes);
app.use("/api/trigger-responses", triggerResponsesRoutes);
app.use("/api/scheduled-messages", scheduledMessagesRoutes);
app.use("/api/leaderboards", leaderboardsRoutes);
app.use("/api/eight-ball-responses", eightBallResponsesRoutes);
app.use("/api/user-mappings", userMappingsRoutes);
app.use("/api/pin-history", pinHistoryRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/audit-log", auditLogRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/guild", guildRoutes);
app.use("/api/guild-members", guildMembersRoutes);
app.use("/api/service-accounts", serviceAccountsRoutes);

app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

await ensureSchemaMigrations();
await seedDevGuildConfig();
await ensureAdminUser();
await ensureBotUser();
await ensureWebViewUser();
app.listen(PORT, () => {
  console.log(`webapi: API running at http://localhost:${PORT}`);
});
