import "dotenv/config";
import express from "express";
import cors from "cors";
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

app.use(cors());
app.use(express.json());

// Log incoming API requests: method, path, query and body
app.use((req, res, next) => {
  const data = {};
  if (req.query && Object.keys(req.query).length > 0) data.query = req.query;
  if (req.body && Object.keys(req.body).length > 0) data.body = req.body;
  console.log("[API request]", {
    method: req.method,
    endpoint: req.originalUrl,
    ...(Object.keys(data).length > 0 ? { data } : {}),
  });
  next();
});

// Health check (no auth)
app.get("/", (req, res) => {
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
          "POST /api/bot-responses/take-a-look",
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
          "GET /api/trigger-responses/random?trigger=xxx",
          "GET /api/trigger-responses/:id",
          "POST /api/trigger-responses (body: { trigger_string, response_string })",
          "PUT /api/trigger-responses/:id",
          "DELETE /api/trigger-responses/:id",
        ],
      },
      leaderboards: {
        authRequired: true,
        routes: [
          "POST /api/leaderboards/plusplus (body: { limit? })",
          "GET /api/leaderboards/plusplus/total?string=&type=word|user",
          "GET /api/leaderboards/plusplus/voter/:userId",
          "POST /api/leaderboards/plusplus/top-voters (body: { limit? })",
          "POST /api/leaderboards/emoji (body: { limit? })",
          "POST /api/leaderboards/repost (body: { limit? })",
          "GET /api/leaderboards/repost/user/:userId",
        ],
      },
    },
    auth: "Use header: Authorization: Bearer <token>",
  });
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

// Only /api/auth is public (login/register). All other /api/* routes require Authorization: Bearer <token>.
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bot-responses", botResponsesRoutes);
app.use("/api/message-processing", messageProcessingRoutes);
app.use("/api/config", configRoutes);
app.use("/api/link-replacements", linkReplacementsRoutes);
app.use("/api/pin-quips", pinQuipsRoutes);
app.use("/api/trigger-responses", triggerResponsesRoutes);
app.use("/api/leaderboards", leaderboardsRoutes);

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
