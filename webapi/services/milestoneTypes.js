/**
 * Fine-grained dictionary of valid milestones.type values. `itemRequired` says whether a
 * milestone of that type must scope to one entity (an emoji id, a plusplus target, a user
 * snowflake, a trigger string, a function name) via `item`, or must leave `item` null (a global
 * metric). `description` is shown to admins via GET /api/milestones/types.
 */
export const MILESTONE_TYPES = Object.freeze({
  pin_total: {
    itemRequired: false,
    description: "Global count of pin_history rows.",
  },
  emoji_frequency_per_app: {
    itemRequired: true,
    description:
      "Sum of emoji_frequency.frequency for one app. item = app name.",
  },
  emoji_frequency_item: {
    itemRequired: true,
    description:
      "Frequency of one specific emoji/sticker. item = emoji/sticker id.",
  },
  emoji_tracked_global: {
    itemRequired: false,
    description: "Count of distinct tracked emojis (excludes stickers).",
  },
  sticker_tracked_global: {
    itemRequired: false,
    description: "Count of distinct tracked stickers.",
  },
  emoji_used_global: {
    itemRequired: false,
    description: "Sum of all emoji usage frequency (excludes stickers).",
  },
  sticker_used_global: {
    itemRequired: false,
    description: "Sum of all sticker usage frequency.",
  },
  plusplus_votes_global: {
    itemRequired: false,
    description: "Total plusplus_tracking row count, all apps.",
  },
  plusplus_votes_per_app: {
    itemRequired: true,
    description: "Plusplus vote count cast within one app. item = app name.",
  },
  plusplus_item_total: {
    itemRequired: true,
    description:
      "SUM of votes for one target (word text or user snowflake). item = target. Not monotonic — can rise and fall; once achieved, stays achieved.",
  },
  plusplus_item_positive: {
    itemRequired: true,
    description: "COUNT of +1 votes for one target. item = target.",
  },
  plusplus_item_negative: {
    itemRequired: true,
    description: "COUNT of -1 votes for one target. item = target.",
  },
  repost_user_total: {
    itemRequired: true,
    description:
      "Repost accusation count against one user. item = user snowflake.",
  },
  repost_global_total: {
    itemRequired: false,
    description: "Global repost accusation count.",
  },
  trigger_call_count: {
    itemRequired: true,
    description:
      "triggers.frequency after increment. item = trigger_string.",
  },
  trigger_function_call_count: {
    itemRequired: true,
    description:
      "trigger_response_functions.frequency after increment. item = function_name.",
  },
});

/**
 * @param {unknown} type
 * @returns {type is keyof typeof MILESTONE_TYPES}
 */
export function isMilestoneTypeSupported(type) {
  return (
    typeof type === "string" &&
    Object.prototype.hasOwnProperty.call(MILESTONE_TYPES, type)
  );
}
