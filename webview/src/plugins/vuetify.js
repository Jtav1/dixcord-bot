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
          primary: "#C75B12",
          secondary: "#A0623A",
          background: "#F3E4CE",
          surface: "#FFF5E8",
          "on-surface": "#4A2E1A",
          "on-background": "#4A2E1A",
        },
      },
      dark: {
        colors: {
          primary: "#F59E0B",
          secondary: "#6E7A88",
          background: "#1A1E24",
          surface: "#252A32",
          "on-surface": "#D6DAE1",
          "on-background": "#D6DAE1",
        },
      },
    },
  },
});

export { THEME_STORAGE_KEY };
