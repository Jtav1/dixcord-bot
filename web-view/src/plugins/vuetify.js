import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";
import { createVuetify } from "vuetify";

const THEME_STORAGE_KEY = "dixcord-view-theme";

/**
 * Reads persisted theme preference from localStorage.
 * @returns {"light" | "dark" | null} Stored theme name, or null if unset/invalid.
 */
function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    // localStorage unavailable (SSR, privacy mode)
  }
  return null;
}

/**
 * Vuetify instance for the application.
 * @returns {ReturnType<typeof createVuetify>}
 */
export default createVuetify({
  theme: {
    defaultTheme: readStoredTheme() ?? "light",
    themes: {
      light: {
        colors: {
          primary: "#B45309",
          secondary: "#6B7F5E",
          background: "#FAF7F2",
          surface: "#FFFCF8",
          "on-surface": "#2C2419",
          "on-background": "#2C2419",
        },
      },
      dark: {
        colors: {
          primary: "#F59E0B",
          secondary: "#8FA882",
          background: "#1A1D23",
          surface: "#242830",
          "on-surface": "#E8E4DE",
          "on-background": "#E8E4DE",
        },
      },
    },
  },
});

export { THEME_STORAGE_KEY };
