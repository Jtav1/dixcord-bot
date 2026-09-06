import { defineConfig, loadEnv } from "vite";
import { attachCachedWebapiAuthHeader } from "./lib/webapiAuth.js";
import { webapiAuthProxyPlugin } from "./lib/webapiAuthProxyPlugin.js";

/**
 * Apply webadmin server env from Vite loadEnv so lib/webapiAuth.js (which reads
 * process.env directly) sees the same values in dev as it would in prod.
 * @param {Record<string, string>} env Loaded .env values.
 * @returns {string} webapi base URL for the dev proxy.
 */
function applyServerEnv(env) {
  process.env["WEBAPI_URL"] =
    env.WEBAPI_URL || process.env["WEBAPI_URL"] || "http://localhost:3000";
  process.env["ADMIN_USERNAME"] = env.ADMIN_USERNAME || process.env["ADMIN_USERNAME"];
  process.env["ADMIN_PASSWORD"] = env.ADMIN_PASSWORD || process.env["ADMIN_PASSWORD"];
  return process.env["WEBAPI_URL"];
}

/**
 * Vite configuration for local development and production builds.
 * @param {{ mode: string }} ctx
 * @returns {import('vite').UserConfig}
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const webapiUrl = applyServerEnv(env);
  const port = parseInt(env.PORT || "3001", 10);
  const apiProxy = {
    "/api": {
      target: webapiUrl,
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on("proxyReq", (proxyReq) => {
          attachCachedWebapiAuthHeader(proxyReq);
        });
        proxy.on("error", (err, req, res) => {
          console.error("webadmin dev API proxy error:", err.message);
          if (res.writeHead && !res.headersSent) {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({ ok: false, error: "Failed to reach webapi" }),
            );
          }
        });
      },
    },
  };

  return {
    plugins: [webapiAuthProxyPlugin()],
    server: {
      port,
      strictPort: true,
      proxy: apiProxy,
    },
    preview: {
      port,
      strictPort: true,
      proxy: apiProxy,
    },
  };
});
