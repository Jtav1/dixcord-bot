import express from "express";
import { authenticate } from "../middleware/auth.js";
import { getDatabaseStatistics } from "../services/statistics.js";

const router = express.Router();

/**
 * GET /api/statistics
 * Aggregate row counts and usage totals across core tracking tables.
 * Auth: required (admin, bot, or webview).
 * @openapi
 * /api/statistics:
 *   get:
 *     operationId: getStatistics
 *     tags: [Statistics]
 *     summary: Get aggregate usage statistics
 *     responses:
 *       '200':
 *         description: Aggregate row counts and usage totals across core tracking tables.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     chatMemberMappings: { type: integer }
 *                     emojiCatalog:
 *                       type: object
 *                       properties:
 *                         emojis: { type: integer }
 *                         stickers: { type: integer }
 *                         total: { type: integer }
 *                     emojiUsage:
 *                       type: object
 *                       properties:
 *                         emojis: { type: integer }
 *                         stickers: { type: integer }
 *                         total: { type: integer }
 *                     pinHistory: { type: integer }
 *                     plusplusTracking: { type: integer }
 *                     triggers: { type: integer }
 *                     responses: { type: integer }
 *                     triggerResponseFrequencySum: { type: integer }
 *                     repostTracking: { type: integer }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const statistics = await getDatabaseStatistics();
    res.json({ ok: true, statistics });
  } catch (err) {
    console.error("GET /api/statistics error:", err);
    res.status(500).json({ ok: false, error: "Failed to get statistics" });
  }
});

export default router;
