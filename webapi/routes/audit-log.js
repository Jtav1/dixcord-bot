import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { listAuditLog } from "../services/auditLog.js";

const router = express.Router();

/**
 * GET /api/audit-log
 * List audit log entries with pagination.
 * Query: ?limit=&offset=
 * Auth: admin required.
 */
router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = req.query.limit != null ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset != null ? parseInt(req.query.offset, 10) : 0;
    const { entries, total } = await listAuditLog({ limit, offset });
    res.json({ ok: true, auditLog: entries, total, limit, offset });
  } catch (err) {
    console.error("GET /api/audit-log error:", err);
    res.status(500).json({ ok: false, error: "Failed to list audit log" });
  }
});

export default router;
