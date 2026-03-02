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

const app = express();
const PORT = process.env.PORT || 3000;

/** Create or update the single admin user from ADMIN_USERNAME and ADMIN_PASSWORD. */
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

// Health check (no auth)
app.get("/", (req, res) => {
  res.json({
    name: "js-express-api-template",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth/login (register disabled; admin only)",
      users: "/api/users/me (GET, PUT, DELETE)",
      botResponses:
        "/api/bot-responses/take-a-look, /api/bot-responses/fortune, /api/bot-responses/link-fixer (POST, auth required)",
      messageProcessing:
        "/api/message-processing/emoji-count, /api/message-processing/plusminus, /api/message-processing/count-repost (POST, auth required)",
      config: "/api/config (GET, auth required)",
      linkReplacements:
        "/api/link-replacements (GET list & GET /:id no auth; POST, PUT /:id, DELETE /:id auth required)",
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
