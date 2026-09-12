import { apiFetch } from "./http.js";

/**
 * List users (chat_member_mapping rows) who have at least one trigger-response history entry.
 * @param {string} [app]
 * @returns {Promise<Array<{ id: number, name: string, handle: string, platformUserId: string, app: string }>>}
 */
export async function fetchTriggerHistoryUsers(app = "discord") {
  const data = await apiFetch(
    `/trigger-responses/history/users?app=${encodeURIComponent(app)}`,
    undefined,
    "Trigger history users",
  );
  return data.users;
}

/**
 * Paginated trigger-response usage history for one user.
 * @param {number} chatMemberId
 * @param {{ limit?: number, offset?: number }} [options]
 * @returns {Promise<{ history: Array<{ id: number, timestamp: string, triggerResponseId: number, triggerString: string, responseString: string }>, total: number }>}
 */
export async function fetchTriggerHistoryForUser(chatMemberId, { limit = 25, offset = 0 } = {}) {
  const data = await apiFetch(
    `/trigger-responses/history/${chatMemberId}?limit=${limit}&offset=${offset}`,
    undefined,
    "Trigger history",
  );
  return { history: data.history, total: data.total };
}
