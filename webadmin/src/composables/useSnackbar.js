import { ref } from "vue";

// Module-scoped (not per-call) so every component shares one snackbar instance.
const message = ref("");
const color = ref("success");
const visible = ref(false);

/**
 * Global single-slot snackbar notifications (latest message replaces previous).
 * @returns {{
 *   message: import("vue").Ref<string>,
 *   color: import("vue").Ref<string>,
 *   visible: import("vue").Ref<boolean>,
 *   notify: (text: string, options?: { color?: "success"|"error"|"info"|"warning", timeout?: number }) => void,
 * }}
 */
export function useSnackbar() {
  /**
   * @param {string} text
   * @param {{ color?: string }} [options]
   * @returns {void}
   */
  function notify(text, options = {}) {
    message.value = text;
    color.value = options.color ?? "success";
    visible.value = true;
  }

  return { message, color, visible, notify };
}
