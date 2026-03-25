import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import db from "./config/db.js";
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

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Create or update the single admin user from ADMIN_USERNAME and ADMIN_PASSWORD.
 * @returns {Promise<void>}
 */
async function ensureAdminUser() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.warn(
      "ADMIN_USERNAME and ADMIN_PASSWORD must be set; no admin user created.",
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
      await db.query("UPDATE users SET password_hash = ? WHERE email = ?", [
        hash,
        username,
      ]);
      console.log("Admin user password updated.");
    } else {
      await db.query(
        "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
        [username, hash, "Admin"],
      );
      console.log("Admin user created.");
    }
  } catch (err) {
    console.error("Failed to ensure admin user:", err);
    throw err;
  }
}

// CORS: allow only frontend/admin origins (192.168.0.2 and Docker bridge 172.17.0.0/16)
function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin or non-browser
  try {
    const host = new URL(origin).hostname;
    if (host === "192.168.0.2") return true;
    if (host === "dixbot-discord") return true;
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
  })
);
app.use(express.json({ limit: "100kb" }));

// Rate limit: public routes (/, /health) — reduce abuse
const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { ok: false, error: "Too many requests, try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit: auth (login/register) — reduce brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { ok: false, error: "Too many login attempts, try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check (no auth)
app.get("/", publicLimiter, (req, res) => {
  res.json({
    name: "js-express-api-template",
    version: "1.0.0",
    endpoints: {
      auth: {
        public: [
          "POST /api/auth/login (admin only; returns JWT)",
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
          "POST /api/message-processing/emoji-count (body: { app: \"discord\", ... })",
          "POST /api/message-processing/plusminus (body: { app: \"discord\", ... })",
          "POST /api/message-processing/count-repost (body: { app: \"discord\", ... })",
          "POST /api/message-processing/emoji-import",
          "POST /api/message-processing/sticker-import",
          "POST /api/message-processing/user-mapping-import (body: { app: \"discord\", users: [{ name, discord_handle, discord_id }] })",
          "POST /api/message-processing/pin-check (body: { messageId })",
          "POST /api/message-processing/pin-log (body: { messageId })",
        ],
      },
      config: {
        authRequired: true,
        routes: [
          "GET /api/config",
          "PUT /api/config (body: { config, value }; updates value if item exists)",
        ],
      },
      linkReplacements: {
        authRequired: true,
        routes: [
          "GET /api/link-replacements",
          "GET /api/link-replacements/:id",
          "POST /api/link-replacements (body: { source_host, target_host })",
          "PUT /api/link-replacements/:id",
          "DELETE /api/link-replacements/:id",
        ],
      },
      pinQuips: {
        authRequired: true,
        routes: [
          "GET /api/pin-quips",
          "GET /api/pin-quips/random",
          "GET /api/pin-quips/:id",
          "POST /api/pin-quips (body: { quip })",
          "PUT /api/pin-quips/:id (body: { quip })",
          "DELETE /api/pin-quips/:id",
        ],
      },
      triggerResponses: {
        authRequired: true,
        routes: [
          "GET /api/trigger-responses",
          "GET /api/trigger-responses/triggers",
          "GET /api/trigger-responses/triggers/list",
          "GET /api/trigger-responses/triggers/responses?trigger= | ?triggerId= (all responses for trigger)",
          "GET /api/trigger-responses/triggers/:id",
          "POST /api/trigger-responses/triggers (body: { trigger_string, selection_mode?, responses: [{ response_string, order?, weight? }] })",
          "PUT /api/trigger-responses/triggers/:id (body: { selection_mode?, responses?: [{ id?: linkId, order?, weight? } | { response_string, order?, weight? }] })",
          "GET /api/trigger-responses/random?trigger=xxx",
          "GET /api/trigger-responses/responses/:id",
          "PUT /api/trigger-responses/responses/:id (body: { response_string })",
          "DELETE /api/trigger-responses/responses/:id",
          "GET /api/trigger-responses/:id",
          "POST /api/trigger-responses (body: { trigger_string, response_string, response_order?, selection_mode?, weight? })",
          "PUT /api/trigger-responses/:id (body: { trigger_string?, response_string?, response_order?, selection_mode?, weight? })",
          "DELETE /api/trigger-responses/:id",
        ],
      },
      leaderboards: {
        authRequired: true,
        routes: [
          "POST /api/leaderboards/plusplus (body: { app: \"discord\", limit? })",
          "GET /api/leaderboards/plusplus/total?app=discord&string=&type=word|user",
          "GET /api/leaderboards/plusplus/voter/:userId?app=discord",
          "POST /api/leaderboards/plusplus/top-voters (body: { app: \"discord\", limit? })",
          "POST /api/leaderboards/emoji (body: { limit? })",
          "POST /api/leaderboards/repost (body: { app: \"discord\", limit? })",
          "GET /api/leaderboards/repost/user/:userId?app=discord",
        ],
      },
      scheduledMessages: {
        authRequired: true,
        routes: [
          "GET /api/scheduled-messages/due?limit= (bot poll; rows include user_id + discord_user_id from chat_member_mapping)",
          "GET /api/scheduled-messages?discord_user_id=&app=discord&status=pending|sent",
          "POST /api/scheduled-messages (body: { discord_user_id, discord_channel_id, discord_guild_id?, message_body, scheduled_at, app? }; stores user_id FK)",
          "PATCH /api/scheduled-messages/:id (body: { status: \"sent\" })",
          "DELETE /api/scheduled-messages/:id?discord_user_id=&app=discord",
        ],
      },
    },
    auth: "Use header: Authorization: Bearer <token>",
  });
});

app.get("/health", publicLimiter, (req, res) => res.json({ status: "ok" }));

// Only /api/auth is public (login/register). All other /api/* routes require Authorization: Bearer <token>.
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bot-responses", botResponsesRoutes);
app.use("/api/message-processing", messageProcessingRoutes);
app.use("/api/config", configRoutes);
app.use("/api/link-replacements", linkReplacementsRoutes);
app.use("/api/pin-quips", pinQuipsRoutes);
app.use("/api/trigger-responses", triggerResponsesRoutes);
app.use("/api/leaderboards", leaderboardsRoutes);
app.use("/api/scheduled-messages", scheduledMessagesRoutes);

// 404
app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

await ensureAdminUser();
app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});
