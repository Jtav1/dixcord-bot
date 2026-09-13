import express from "express";
import { authenticate, requireOwnGuildOrAdmin } from "../middleware/auth.js";
import { getGuildSnapshot, upsertGuildSnapshot } from "../services/guildInfo.js";

const router = express.Router();

/**
 * GET /api/guild
 * Read the most recently synced guild snapshot (metadata, channels, roles, emoji/sticker
 * catalog), optionally filtered to a specific app/guildId.
 * Query: { app?: string, guildId?: string }
 * Auth: required.
 * @openapi
 * /api/guild:
 *   get:
 *     operationId: getGuild
 *     tags: [Guild]
 *     summary: Get the synced guild snapshot
 *     description: Returns the most recently synced (app, guildId) pair when neither query param is given.
 *     parameters:
 *       - name: app
 *         in: query
 *         required: false
 *         schema: { type: string, example: discord }
 *       - name: guildId
 *         in: query
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Guild snapshot.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 guild: { type: object }
 *                 channels: { type: array, items: { type: object } }
 *                 roles: { type: array, items: { type: object } }
 *                 emojis: { type: array, items: { type: object } }
 *                 stickers: { type: array, items: { type: object } }
 *                 syncedAt: { type: string }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const { app, guildId } = req.query;
    const result = await getGuildSnapshot({
      app: typeof app === "string" ? app : undefined,
      guildId: typeof guildId === "string" ? guildId : undefined,
    });
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: result.error });
    }
    res.json(result);
  } catch (err) {
    console.error("GET /api/guild error:", err);
    res.status(500).json({ ok: false, error: "Failed to get guild info" });
  }
});

/**
 * POST /api/guild/sync
 * Push a full guild snapshot (metadata, channels, roles) from a platform client. Fully
 * replaces that app/guildId's channels and roles rows.
 * Body: { app: string, guildId: string, guild: object, channels: Array<object>, roles: Array<object> }
 * Auth: required. A guild-scoped bot account may only sync its own guildId.
 * @openapi
 * /api/guild/sync:
 *   post:
 *     operationId: syncGuild
 *     tags: [Guild]
 *     summary: Push a full guild snapshot
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [app, guildId, guild, channels, roles]
 *             properties:
 *               app: { type: string, example: discord }
 *               guildId: { type: string }
 *               guild: { type: object }
 *               channels: { type: array, items: { type: object } }
 *               roles: { type: array, items: { type: object } }
 *     responses:
 *       '200':
 *         description: Snapshot stored.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenRole'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post("/sync", authenticate, requireOwnGuildOrAdmin, async (req, res) => {
  try {
    const { app, guildId, guild, channels, roles } = req.body ?? {};
    const result = await upsertGuildSnapshot({ app, guildId, guild, channels, roles });
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/guild/sync error:", err);
    res.status(500).json({ ok: false, error: "Failed to sync guild info" });
  }
});

export default router;
