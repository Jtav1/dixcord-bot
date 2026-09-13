import express from "express";
import bcrypt from "bcryptjs";
import db from "../config/db.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { recordAudit } from "../services/auditLog.js";

/**
 * Admin-only provisioning for extra bot/webview service accounts, needed so more than one bot
 * account can exist (e.g. one per guild for requireOwnGuildOrAdmin scoping). Deliberately minimal:
 * no admin-role creation, no password reset/guildId-change (delete-and-recreate instead), no
 * webadmin UI yet.
 */

const router = express.Router();
router.use(authenticate, requireAdmin);

const CREATABLE_ROLES = new Set(["bot", "webview"]);

/**
 * GET /api/service-accounts?role=&guildId=
 * List service accounts (all roles included; only bot/webview are mutable via this router).
 * Auth: admin required.
 * @openapi
 * /api/service-accounts:
 *   get:
 *     operationId: listServiceAccounts
 *     tags: [Service Accounts]
 *     summary: List service accounts
 *     description: Requires the admin role. Admin rows are included for visibility but cannot be created or deleted here.
 *     parameters:
 *       - name: role
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [admin, bot, webview] }
 *       - name: guildId
 *         in: query
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Matching service accounts.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 accounts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       email: { type: string }
 *                       name: { type: string }
 *                       role: { type: string }
 *                       guildId: { type: string, nullable: true }
 *                       created_at: { type: string, format: date-time }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", async (req, res) => {
  try {
    const { role, guildId } = req.query;
    const conditions = [];
    const params = [];
    if (typeof role === "string" && role.trim()) {
      conditions.push("role = ?");
      params.push(role.trim());
    }
    if (typeof guildId === "string" && guildId.trim()) {
      conditions.push("guild_id = ?");
      params.push(guildId.trim());
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await db.query(
      `SELECT id, email, name, role, guild_id AS guildId, created_at
       FROM users ${where} ORDER BY id ASC`,
      params,
    );
    res.json({ ok: true, accounts: rows ?? [] });
  } catch (err) {
    console.error("GET /api/service-accounts error:", err);
    res.status(500).json({ ok: false, error: "Failed to list service accounts" });
  }
});

/**
 * POST /api/service-accounts
 * Create a bot or webview service account, optionally bound to a guildId.
 * Body: { email, password, name, role: "bot"|"webview", guildId? }
 * Auth: admin required.
 * @openapi
 * /api/service-accounts:
 *   post:
 *     operationId: createServiceAccount
 *     tags: [Service Accounts]
 *     summary: Create a bot or webview service account
 *     description: >
 *       Requires the admin role. role must be "bot" or "webview" — admin accounts cannot be
 *       created via this route. guildId scopes a bot (or webview) account to one guild for
 *       requireOwnGuildOrAdmin-gated routes; omit for an unrestricted account.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name, role]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password, description: "Minimum 8 characters." }
 *               name: { type: string }
 *               role: { type: string, enum: [bot, webview] }
 *               guildId: { type: string, nullable: true }
 *     responses:
 *       '201':
 *         description: Created service account.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 account:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     email: { type: string }
 *                     name: { type: string }
 *                     role: { type: string }
 *                     guildId: { type: string, nullable: true }
 *                     created_at: { type: string, format: date-time }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '409':
 *         description: Email already in use.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim();
    const password = String(req.body?.password ?? "");
    const name = String(req.body?.name ?? "").trim();
    const role = String(req.body?.role ?? "").trim();
    const guildId = String(req.body?.guildId ?? "").trim() || null;

    if (!email || !password || !name || !role) {
      return res.status(400).json({
        ok: false,
        error: "email, password, name, and role are required",
      });
    }
    if (!CREATABLE_ROLES.has(role)) {
      return res.status(400).json({ ok: false, error: "role must be bot or webview" });
    }
    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: "password must be at least 8 characters" });
    }

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ ok: false, error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      "INSERT INTO users (email, password_hash, name, role, guild_id) VALUES (?, ?, ?, ?, ?)",
      [email, passwordHash, name, role, guildId],
    );
    const id = result?.insertId ?? result?.lastInsertRowid;

    await recordAudit(req.user.id, "create", "service_account", String(id), {
      email,
      role,
      guildId,
    });

    const [rows] = await db.query(
      "SELECT id, email, name, role, guild_id AS guildId, created_at FROM users WHERE id = ?",
      [id],
    );
    res.status(201).json({ ok: true, account: rows?.[0] });
  } catch (err) {
    console.error("POST /api/service-accounts error:", err);
    res.status(500).json({ ok: false, error: "Failed to create service account" });
  }
});

/**
 * DELETE /api/service-accounts/:id
 * Delete a bot or webview service account.
 * Auth: admin required.
 * @openapi
 * /api/service-accounts/{id}:
 *   delete:
 *     operationId: deleteServiceAccount
 *     tags: [Service Accounts]
 *     summary: Delete a bot or webview service account
 *     description: Requires the admin role. Admin accounts cannot be deleted via this route.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const [rows] = await db.query("SELECT id, email, role FROM users WHERE id = ?", [id]);
    const row = rows?.[0];
    if (!row) {
      return res.status(404).json({ ok: false, error: "Service account not found" });
    }
    if (!CREATABLE_ROLES.has(row.role)) {
      return res.status(403).json({
        ok: false,
        error: "Only bot or webview accounts can be deleted via this route",
      });
    }

    await db.query("DELETE FROM users WHERE id = ?", [id]);
    await recordAudit(req.user.id, "delete", "service_account", String(id), {
      email: row.email,
      role: row.role,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/service-accounts/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete service account" });
  }
});

export default router;
