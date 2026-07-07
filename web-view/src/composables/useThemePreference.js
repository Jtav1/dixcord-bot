import { computed } from "vue";
import { useTheme } from "vuetify";
import { THEME_STORAGE_KEY } from "../plugins/vuetify.js";

/**
 * Manages light/dark theme preference with localStorage persistence.
 * @returns {{
 *   isDark: import("vue").ComputedRef<boolean>,
 *   toggleTheme: () => void,
 *   setTheme: (name: "light" | "dark") => void,
 * }}
 */
export function useThemePreference() {
  const theme = useTheme();

  const isDark = computed(() => theme.global.name.value === "dark");

  /**
   * Persists and applies a theme name.
   * @param {"light" | "dark"} name
   * @returns {void}
   */
  function setTheme(name) {
    theme.global.name.value = name;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, name);
    } catch {
      // localStorage unavailable
    }
  }

  /**
   * Switches between light and dark themes.
   * @returns {void}
   */
  function toggleTheme() {
    setTheme(isDark.value ? "light" : "dark");
  }

  return { isDark, toggleTheme, setTheme };
}
