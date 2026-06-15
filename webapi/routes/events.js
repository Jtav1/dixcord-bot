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
 * Auth: admin required.
 */
router.get("/plusplus", authenticate, requireAdmin, async (req, res) => {
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
 * Auth: admin required.
 */
router.get("/reposts", authenticate, requireAdmin, async (req, res) => {
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
