import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import db from "./config/db.js";
import { ensureSchemaMigrations } from "./scripts/ensureSchema.js";
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

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = "2.2.0";

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
    const [rows] = await db.query(
      "SELECT id, password_hash FROM users WHERE email = ?",
      [username],
    );
    const hash = await bcrypt.hash(password, 10);
    if (rows && rows.length > 0) {
      await db.query(
        "UPDATE users SET password_hash = ?, role = 'admin' WHERE email = ?",
        [hash, username],
      );
      console.log("webapi: Admin user password updated.");
    } else {
      await db.query(
        "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')",
        [username, hash, "Admin"],
      );
      console.log("webapi: Admin user created.");
    }
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
    const [rows] = await db.query(
      "SELECT id, password_hash FROM users WHERE email = ?",
      [username],
    );
    const hash = await bcrypt.hash(password, 10);
    if (rows && rows.length > 0) {
      await db.query(
        "UPDATE users SET password_hash = ?, role = 'bot' WHERE email = ?",
        [hash, username],
      );
      console.log("webapi: Bot service account password updated.");
    } else {
      await db.query(
        "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'bot')",
        [username, hash, "Bot"],
      );
      console.log("webapi: Bot service account created.");
    }
  } catch (err) {
    console.error("webapi: Failed to ensure bot user:", err);
    throw err;
  }
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

app.get("/", publicLimiter, (req, res) => {
  res.json({
    name: "dixcord-webapi",
    version: API_VERSION,
    endpoints: {
      auth: {
        public: [
          "POST /api/auth/login (admin or bot service account; returns JWT)",
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
          "GET /api/config (includes entriesWithMeta)",
          "POST /api/config (body: { config, value })",
          "PUT /api/config (body: { config, value })",
          "DELETE /api/config/:key",
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
        routes: ["GET /api/pin-history?limit=&offset="],
      },
      system: {
        authRequired: true,
        routes: [
          "GET /api/system/status (admin)",
          "GET /api/system/cache-version",
          "POST /api/system/invalidate-cache (admin)",
          "POST /api/system/heartbeat (body: { guildId, version })",
        ],
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
          "POST /api/message-processing/user-mapping-import",
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

app.get("/health", publicLimiter, (req, res) => res.json({ status: "ok" }));

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

app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

await ensureSchemaMigrations();
await ensureAdminUser();
await ensureBotUser();
app.listen(PORT, () => {
  console.log(`webapi: API running at http://localhost:${PORT}`);
});
