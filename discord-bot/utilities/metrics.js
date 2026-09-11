/**
 * In-process cumulative activity counters, reported to webapi on each heartbeat (see api/system.js)
 * and exposed there via GET /metrics. Resets to 0 on bot restart - expected/normal Prometheus
 * counter-reset behavior, not a bug.
 */

const counters = {
  commandsTotal: {},
  commandErrorsTotal: {},
  messagesProcessedTotal: 0,
  triggerResponsesMatchedTotal: 0,
  linkFixerTriggeredTotal: 0,
  remindersCreatedTotal: 0,
  reminderParseFailuresTotal: 0,
  eightBallResponsesTotal: 0,
  emojiCountedTotal: 0,
  stickerCountedTotal: 0,
  plusplusVotesTotal: 0,
  reactionsProcessedTotal: 0,
  pinsLoggedTotal: 0,
  repostsDetectedTotal: 0,
  guildMemberJoinsTotal: 0,
  scheduledMessagesSentTotal: 0,
  cachePollErrorsTotal: 0,
  heartbeatSendErrorsTotal: 0,
  discordGuildJoinsTotal: 0,
  discordGuildLeavesTotal: 0,
  discordRateLimitHitsTotal: 0,
  discordShardErrorsTotal: 0,
  discordClientErrorsTotal: 0,
  apiCallErrorsTotal: {},
};

/**
 * Increment a counter. For scalar counters pass just `name`; for the breakdown counters
 * (commandsTotal, commandErrorsTotal, apiCallErrorsTotal) also pass `key`.
 * @param {keyof typeof counters} name
 * @param {string} [key]
 * @returns {void}
 */
export function incrementCounter(name, key) {
  if (!(name in counters)) return;
  if (key !== undefined) {
    const bucket = counters[name];
    if (typeof bucket !== "object" || bucket === null) return;
    bucket[key] = (bucket[key] ?? 0) + 1;
  } else if (typeof counters[name] === "number") {
    counters[name] += 1;
  }
}

/**
 * Snapshot of all cumulative counters, sent verbatim as the heartbeat's `metrics` field.
 * @returns {Record<string, unknown>}
 */
export function getMetricsSnapshot() {
  return structuredClone(counters);
}
