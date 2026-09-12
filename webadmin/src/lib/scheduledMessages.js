import { apiFetch, apiFetchJson } from "./http.js";

/**
 * Admin-scoped, paginated list of scheduled messages (reminders) across all users.
 * @param {{ status?: "pending"|"sent"|"all", limit?: number, offset?: number }} [options]
 * @returns {Promise<{ items: Array<object>, total: number }>}
 */
export async function fetchScheduledMessages({ status = "all", limit = 25, offset = 0 } = {}) {
  const params = new URLSearchParams({
    app: "discord",
    scope: "admin",
    status,
    limit: String(limit),
    offset: String(offset),
  });
  const data = await apiFetch(`/scheduled-messages?${params}`, undefined, "Scheduled messages");
  return { items: data.scheduledMessages, total: data.total };
}

/**
 * Admin override update (works regardless of status).
 * @param {number} id
 * @param {{ message_body?: string, scheduled_at?: string }} fields
 * @returns {Promise<object>}
 */
export async function updateScheduledMessage(id, fields) {
  const data = await apiFetchJson(
    "PUT",
    `/scheduled-messages/${id}`,
    { scope: "admin", app: "discord", ...fields },
    "Update reminder",
  );
  return data.scheduledMessage;
}

/**
 * Admin override delete (works regardless of status).
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteScheduledMessage(id) {
  await apiFetch(`/scheduled-messages/${id}?scope=admin`, { method: "DELETE" }, "Delete reminder");
}
