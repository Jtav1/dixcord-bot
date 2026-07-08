import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { fileURLToPath } from "url";
import {
  attachCachedWebapiAuthHeader,
  requireWebviewCredentials,
  warmWebapiAuth,
  webapiAuthProxyMiddleware,
} from "./lib/webapiAuth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3002", 10);
const WEBAPI_URL = process.env.WEBAPI_URL || "http://localhost:3000";
const distDir = path.join(__dirname, "dist");

try {
  requireWebviewCredentials();
} catch (err) {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.WEBVIEW_API_RATE_LIMIT_MAX || "120", 10),
  message: { ok: false, error: "Too many requests, try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Health check for Docker and load balancers.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @returns {void}
 */
function healthHandler(_req, res) {
  res.json({ ok: true });
}

app.get("/health", healthHandler);
app.use("/api", apiLimiter);
app.use("/api", (req, res, next) => {
  void webapiAuthProxyMiddleware(req, res, next);
});
app.use(
  "/api",
  createProxyMiddleware({
    target: `${WEBAPI_URL.replace(/\/+$/, "")}/api`,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq) => {
        attachCachedWebapiAuthHeader(proxyReq);
      },
      error: (err, req, res) => {
        console.error("web-view API proxy error:", err.message);
        if (!res.headersSent) {
          res.status(502).json({
            ok: false,
            error: "Failed to reach webapi",
          });
        }
      },
    },
  }),
);
app.use("/files", express.static(path.join(__dirname, "files")));
app.use(express.static(distDir));
app.use((req, res) => {
  const url = req.originalUrl || req.url || "";
  if (url.startsWith("/api")) {
    res.status(502).json({ ok: false, error: "API proxy unavailable" });
    return;
  }
  res.sendFile(path.join(distDir, "index.html"));
});

await warmWebapiAuth();
app.listen(PORT, () => {
  console.log(`web-view listening on http://localhost:${PORT}`);
  console.log(`webapi proxy target: ${WEBAPI_URL}`);
});
