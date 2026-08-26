import express from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import {
  listPlusplusEvents,
  listRepostEvents,
  listStickerCatalog,
} from "../services/events.js";
import { resolveChatAppFromRequest } from "../utils/chatAppHttp.js";

const router = express.Router();

/**
 * GET /api/events/plusplus
 * Raw plusplus tracking events.
 * Query: ?app=discord&from=&to=&limit=&offset=
 * Auth: required (admin or bot).
 * @openapi
 * /api/events/plusplus:
 *   get:
 *     operationId: listPlusplusEvents
 *     tags: [Events]
 *     summary: List raw plusplus tracking events
 *     parameters:
 *       - name: app
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [discord], default: discord }
 *       - name: from
 *         in: query
 *         required: false
 *         schema: { type: string, format: date-time }
 *         description: Inclusive lower bound on event timestamp.
 *       - name: to
 *         in: query
 *         required: false
 *         schema: { type: string, format: date-time }
 *         description: Inclusive upper bound on event timestamp.
 *       - name: limit
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - name: offset
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       '200':
 *         description: Page of raw plusplus tracking events, most recent first.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       type: { type: string }
 *                       string: { type: string, nullable: true }
 *                       value: { type: string, nullable: true }
 *                       voterPlatformId: { type: string, nullable: true }
 *                       timestamp: { type: string }
 *                 total: { type: integer }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/plusplus", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req) ?? "discord";
    const { events, total } = await listPlusplusEvents({
      app,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ ok: true, events, total });
  } catch (err) {
    console.error("GET /api/events/plusplus error:", err);
    res
      .status(500)
      .json({ ok: false, error: "Failed to list plusplus events" });
  }
});

/**
 * GET /api/events/reposts
 * Raw repost tracking events.
 * Query: ?app=discord&userId=&from=&to=&limit=&offset=
 * Auth: required (admin or bot).
 * @openapi
 * /api/events/reposts:
 *   get:
 *     operationId: listRepostEvents
 *     tags: [Events]
 *     summary: List raw repost tracking events
 *     parameters:
 *       - name: app
 *         in: query
 *         required: false
 *         schema: { type: string, enum: [discord], default: discord }
 *       - name: userId
 *         in: query
 *         required: false
 *         schema: { type: string }
 *         description: Platform user id to filter reposts by (the accused user).
 *       - name: from
 *         in: query
 *         required: false
 *         schema: { type: string, format: date-time }
 *         description: Inclusive lower bound on event timestamp.
 *       - name: to
 *         in: query
 *         required: false
 *         schema: { type: string, format: date-time }
 *         description: Inclusive upper bound on event timestamp.
 *       - name: limit
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - name: offset
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       '200':
 *         description: Page of raw repost tracking events, most recent first.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       msgid: { type: string }
 *                       msgcontents: { type: string, nullable: true }
 *                       useridPlatformId: { type: string }
 *                       accuserPlatformId: { type: string }
 *                       timestamp: { type: string }
 *                 total: { type: integer }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/reposts", authenticate, async (req, res) => {
  try {
    const app = resolveChatAppFromRequest(req) ?? "discord";
    const { events, total } = await listRepostEvents({
      app,
      userId: req.query.userId,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ ok: true, events, total });
  } catch (err) {
    console.error("GET /api/events/reposts error:", err);
    res.status(500).json({ ok: false, error: "Failed to list repost events" });
  }
});

/**
 * GET /api/events/stickers
 * Sticker catalog from emoji_frequency (type=sticker).
 * Query: ?limit=
 * Auth: admin required.
 * @openapi
 * /api/events/stickers:
 *   get:
 *     operationId: listStickerCatalog
 *     tags: [Events]
 *     summary: List the sticker catalog
 *     description: Requires the admin role.
 *     parameters:
 *       - name: limit
 *         in: query
 *         required: false
 *         schema: { type: integer, default: 50, maximum: 200 }
 *     responses:
 *       '200':
 *         description: Stickers ordered by usage frequency, descending.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 stickers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       emoid: { type: string }
 *                       name: { type: string }
 *                       frequency: { type: integer }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/stickers", authenticate, requireAdmin, async (req, res) => {
  try {
    const stickers = await listStickerCatalog(
      req.query.limit != null ? parseInt(req.query.limit, 10) : 50,
    );
    res.json({ ok: true, stickers });
  } catch (err) {
    console.error("GET /api/events/stickers error:", err);
    res.status(500).json({ ok: false, error: "Failed to list stickers" });
  }
});

export default router;
