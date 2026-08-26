import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { listAuditLog } from "../services/auditLog.js";

const router = express.Router();

/**
 * GET /api/audit-log
 * List audit log entries with pagination.
 * Query: ?limit=&offset=
 * Auth: admin required.
 * @openapi
 * /api/audit-log:
 *   get:
 *     operationId: listAuditLog
 *     tags: [Audit Log]
 *     summary: List audit log entries
 *     description: Requires the admin role.
 *     parameters:
 *       - name: limit
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 50 }
 *       - name: offset
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       '200':
 *         description: Page of audit log entries, most recent first.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 auditLog:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       user_id: { type: integer }
 *                       user_email: { type: string, nullable: true }
 *                       action: { type: string }
 *                       resource: { type: string }
 *                       resource_id: { type: string, nullable: true }
 *                       details: { type: object }
 *                       created_at: { type: string }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
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
