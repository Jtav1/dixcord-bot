import { defineConfig, loadEnv } from "vite";

/**
 * Vite configuration for local development and production builds.
 * @param {{ mode: string }} ctx
 * @returns {import('vite').UserConfig}
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = parseInt(env.PORT || "3002", 10);
  const webapiUrl = env.WEBAPI_URL || "http://localhost:3000";
  const apiProxy = {
    "/api": {
      target: webapiUrl,
      changeOrigin: true,
    },
  };

  return {
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
