/**
 * Send milestone messages returned by webapi increment endpoints back to the Discord
 * channel/message that triggered the increment. Best-effort: never throws.
 */

/**
 * @param {{ reply?: Function, send?: Function } | null | undefined} target - a Message (uses .reply) or a channel (falls back to .send)
 * @param {Array<{ message: string }> | null | undefined} milestones
 * @returns {Promise<void>}
 */
export async function announceMilestones(target, milestones) {
  if (!target || !Array.isArray(milestones) || milestones.length === 0) return;
  for (const m of milestones) {
    if (!m?.message) continue;
    try {
      if (typeof target.reply === "function") {
        await target.reply(m.message);
      } else if (typeof target.send === "function") {
        await target.send(m.message);
      }
    } catch (err) {
      console.error("bot: failed to send milestone message:", err);
    }
  }
}
