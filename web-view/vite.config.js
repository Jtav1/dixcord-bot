import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";
import vuetify from "vite-plugin-vuetify";
import { webapiAuthProxyPlugin } from "./lib/webapiAuthProxyPlugin.js";
import { attachCachedWebapiAuthHeader } from "./lib/webapiAuth.js";

/**
 * Vite configuration for local development and production builds.
 * @param {{ mode: string }} ctx
 * @returns {import('vite').UserConfig}
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  process.env.WEBAPI_URL = env.WEBAPI_URL || process.env.WEBAPI_URL;
  process.env.WEBVIEW_USERNAME =
    env.WEBVIEW_USERNAME || process.env.WEBVIEW_USERNAME;
  process.env.WEBVIEW_PASSWORD =
    env.WEBVIEW_PASSWORD || process.env.WEBVIEW_PASSWORD;
  const port = parseInt(env.PORT || "3002", 10);
  const webapiUrl = env.WEBAPI_URL || "http://localhost:3000";
  const apiProxy = {
    "/api": {
      target: webapiUrl,
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on("proxyReq", (proxyReq) => {
          attachCachedWebapiAuthHeader(proxyReq);
        });
      },
    },
  };

  return {
    plugins: [
      webapiAuthProxyPlugin(),
      vue(),
      vuetify({ autoImport: true }),
    ],
    server: {
      port,
      proxy: apiProxy,
    },
    preview: {
      port,
      proxy: apiProxy,
    },
  };
});
