import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  createUserMapping,
  deleteUserMapping,
  getUserMappingById,
  listUserMappings,
  updateUserMapping,
} from "../services/userMappings.js";
import {
  CHAT_APP_PARAM_ERROR,
  resolveChatAppFromRequest,
} from "../utils/chatAppHttp.js";
import { recordAudit } from "../services/auditLog.js";

const router = express.Router();

/**
 * GET /api/user-mappings
 * List user mappings with pagination.
 * Query: ?app=discord&limit=&offset=&search=
 * Auth: admin required.
 */
router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const limit = req.query.limit != null ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset != null ? parseInt(req.query.offset, 10) : 0;
    const search = req.query.search;

    const { rows, total } = await listUserMappings(app, { limit, offset, search });
    res.json({ ok: true, userMappings: rows, total, limit, offset });
  } catch (err) {
    console.error("GET /api/user-mappings error:", err);
    res.status(500).json({ ok: false, error: "Failed to list user mappings" });
  }
});

/**
 * GET /api/user-mappings/:id
 * Get one user mapping by id.
 * Query: ?app=discord
 * Auth: admin required.
 */
router.get("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const row = await getUserMappingById(app, id);
    if (!row) {
      return res.status(404).json({ ok: false, error: "User mapping not found" });
    }
    res.json({ ok: true, userMapping: row });
  } catch (err) {
    console.error("GET /api/user-mappings/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to get user mapping" });
  }
});

/**
 * POST /api/user-mappings
 * Create a user mapping.
 * Body: { app, name, handle, platformUserId }
 * Auth: admin required.
 */
router.post("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const name = String(req.body?.name ?? "").trim();
    const handle = String(req.body?.handle ?? "").trim();
    const platformUserId = String(
      req.body?.platformUserId ?? req.body?.discord_id ?? "",
    ).trim();

    if (!name || !handle || !platformUserId) {
      return res.status(400).json({
        ok: false,
        error: "name, handle, and platformUserId are required",
      });
    }

    const id = await createUserMapping(app, { name, handle, platformUserId });
    if (id == null) {
      return res.status(500).json({ ok: false, error: "Failed to create user mapping" });
    }

    const row = await getUserMappingById(app, id);
    await recordAudit(req.user.id, "create", "chat_member_mapping", id, { name });
    res.status(201).json({ ok: true, userMapping: row });
  } catch (err) {
    console.error("POST /api/user-mappings error:", err);
    const msg = err.code === "ER_DUP_ENTRY" || String(err.message).includes("UNIQUE")
      ? "Duplicate name, handle, or platform user id"
      : "Failed to create user mapping";
    res.status(400).json({ ok: false, error: msg });
  }
});

/**
 * PUT /api/user-mappings/:id
 * Update a user mapping.
 * Body: { app, name?, handle?, platformUserId? }
 * Auth: admin required.
 */
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const updated = await updateUserMapping(id, app, {
      name: req.body?.name,
      handle: req.body?.handle,
      platformUserId: req.body?.platformUserId ?? req.body?.discord_id,
    });

    if (!updated) {
      const existing = await getUserMappingById(app, id);
      if (!existing) {
        return res.status(404).json({ ok: false, error: "User mapping not found" });
      }
      return res.status(400).json({
        ok: false,
        error: "Provide name, handle, and/or platformUserId to update",
      });
    }

    const row = await getUserMappingById(app, id);
    await recordAudit(req.user.id, "update", "chat_member_mapping", id, {});
    res.json({ ok: true, userMapping: row });
  } catch (err) {
    console.error("PUT /api/user-mappings/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to update user mapping" });
  }
});

/**
 * DELETE /api/user-mappings/:id
 * Delete a user mapping.
 * Query: ?app=discord
 * Auth: admin required.
 */
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req);
    if (!app) return res.status(400).json(CHAT_APP_PARAM_ERROR);

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }

    const existing = await getUserMappingById(app, id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "User mapping not found" });
    }

    const deleted = await deleteUserMapping(id);
    if (!deleted) {
      return res.status(500).json({ ok: false, error: "Failed to delete user mapping" });
    }

    await recordAudit(req.user.id, "delete", "chat_member_mapping", id, {});
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/user-mappings/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to delete user mapping" });
  }
});

export default router;
