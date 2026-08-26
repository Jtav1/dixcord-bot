import express from "express";
import { authenticate } from "../middleware/auth.js";
import { getPinHistoryById, listIncompletePinHistory, listPinHistory, updatePinHistory } from "../services/pinHistory.js";

const router = express.Router();

/**
 * GET /api/pin-history
 * List pin history entries with pagination.
 * Query: ?limit=&offset=
 * Auth: required (admin or bot).
 * @openapi
 * /api/pin-history:
 *   get:
 *     operationId: listPinHistory
 *     tags: [Pin History]
 *     summary: List pin history entries
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
 *         description: Page of pin history entries, newest first.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 pinHistory:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       msgid: { type: string }
 *                       timestamp: { type: string }
 *                       author: { type: integer, nullable: true }
 *                       contents: { type: string, nullable: true }
 *                       attachments:
 *                         type: array
 *                         items: { type: string }
 *                       channelId: { type: string, nullable: true }
 *                       channelName: { type: string, nullable: true }
 *                       pinners:
 *                         type: array
 *                         items: { type: integer }
 *                       hydrated: { type: boolean }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const limit = req.query.limit != null ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset != null ? parseInt(req.query.offset, 10) : 0;
    const { entries, total } = await listPinHistory({ limit, offset });
    res.json({ ok: true, pinHistory: entries, total, limit, offset });
  } catch (err) {
    console.error("GET /api/pin-history error:", err);
    res.status(500).json({ ok: false, error: "Failed to list pin history" });
  }
});

/**
 * GET /api/pin-history/incomplete
 * List pin_history rows not yet hydrated (`hydrated = false`).
 * Query: ?limit=&offset=
 * Auth: required (admin or bot).
 * @openapi
 * /api/pin-history/incomplete:
 *   get:
 *     operationId: listIncompletePinHistory
 *     tags: [Pin History]
 *     summary: List pin history entries not yet hydrated
 *     description: Returns pin_history rows where hydrated = false, ordered oldest id first.
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
 *         description: Page of unhydrated pin history entries.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 pinHistory:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       msgid: { type: string }
 *                       timestamp: { type: string }
 *                       author: { type: integer, nullable: true }
 *                       contents: { type: string, nullable: true }
 *                       attachments:
 *                         type: array
 *                         items: { type: string }
 *                       channelId: { type: string, nullable: true }
 *                       channelName: { type: string, nullable: true }
 *                       pinners:
 *                         type: array
 *                         items: { type: integer }
 *                       hydrated: { type: boolean }
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/incomplete", authenticate, async (req, res) => {
  try {
    const limit = req.query.limit != null ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset != null ? parseInt(req.query.offset, 10) : 0;
    const { entries, total } = await listIncompletePinHistory({ limit, offset });
    res.json({ ok: true, pinHistory: entries, total, limit, offset });
  } catch (err) {
    console.error("GET /api/pin-history/incomplete error:", err);
    res.status(500).json({ ok: false, error: "Failed to list incomplete pin history" });
  }
});

/**
 * GET /api/pin-history/:id
 * Get one pin history entry by primary key.
 * Auth: required (admin or bot).
 * @openapi
 * /api/pin-history/{id}:
 *   get:
 *     operationId: getPinHistoryEntry
 *     tags: [Pin History]
 *     summary: Get one pin history entry by id
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: The pin history entry.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 pin:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     msgid: { type: string }
 *                     timestamp: { type: string }
 *                     author: { type: integer, nullable: true }
 *                     contents: { type: string, nullable: true }
 *                     attachments:
 *                       type: array
 *                       items: { type: string }
 *                     channelId: { type: string, nullable: true }
 *                     channelName: { type: string, nullable: true }
 *                     pinners:
 *                       type: array
 *                       items: { type: integer }
 *                     hydrated: { type: boolean }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const entry = await getPinHistoryById(id);
    if (!entry) {
      return res.status(404).json({ ok: false, error: "Pin not found" });
    }
    res.json({ ok: true, pin: entry });
  } catch (err) {
    console.error("GET /api/pin-history/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to get pin history entry" });
  }
});

/**
 * PUT /api/pin-history/:id
 * Update one pin history entry (partial body supported).
 * Body fields: app?, author?, authorId?, contents?, attachments?, channelId?, channelName?, pinners?, pinnerIds?
 * Auth: required (admin or bot).
 * @openapi
 * /api/pin-history/{id}:
 *   put:
 *     operationId: updatePinHistoryEntry
 *     tags: [Pin History]
 *     summary: Update one pin history entry
 *     description: >
 *       Partial update; only provided fields are changed. `app` (a supported chat-member app id)
 *       is required when `authorId` or `pinnerIds` is provided, since those are resolved to
 *       chat_member_mapping ids via that app. `author`/`pinners` accept resolved mapping ids
 *       directly instead.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               app: { type: string, description: "Chat-member app id; required when authorId or pinnerIds is set." }
 *               author: { type: integer, nullable: true, description: "chat_member_mapping id." }
 *               authorId: { type: string, nullable: true, description: "Platform user id, resolved via app." }
 *               contents: { type: string, nullable: true }
 *               attachments:
 *                 type: array
 *                 items: { type: string }
 *               channelId: { type: string, nullable: true }
 *               channelName: { type: string, nullable: true }
 *               pinners:
 *                 type: array
 *                 items: { type: integer }
 *                 description: chat_member_mapping ids.
 *               pinnerIds:
 *                 type: array
 *                 items: { type: string }
 *                 description: Platform user ids, resolved via app.
 *               hydrated: { type: boolean }
 *     responses:
 *       '200':
 *         description: Updated pin history entry.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 pin:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     msgid: { type: string }
 *                     timestamp: { type: string }
 *                     author: { type: integer, nullable: true }
 *                     contents: { type: string, nullable: true }
 *                     attachments:
 *                       type: array
 *                       items: { type: string }
 *                     channelId: { type: string, nullable: true }
 *                     channelName: { type: string, nullable: true }
 *                     pinners:
 *                       type: array
 *                       items: { type: integer }
 *                     hydrated: { type: boolean }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.put("/:id", authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid id" });
    }
    const result = await updatePinHistory(id, req.body ?? {});
    if (!result.ok) {
      const status = result.notFound ? 404 : 400;
      return res.status(status).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, pin: result.pin });
  } catch (err) {
    console.error("PUT /api/pin-history/:id error:", err);
    res.status(500).json({ ok: false, error: "Failed to update pin history entry" });
  }
});

export default router;
