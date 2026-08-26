<template>
  <div>
    <template v-if="loading">
      <v-skeleton-loader
        v-for="n in skeletonCount"
        :key="`${listKey}-skeleton-${n}`"
        type="list-item-two-line"
        class="mb-2"
      />
    </template>

    <p
      v-else-if="entries.length === 0"
      class="text-body-2 text-medium-emphasis text-center py-8"
    >
      No scores yet.
    </p>

    <v-expansion-panels
      v-else
      v-model="expandedKey"
      variant="accordion"
      class="leaderboard-panels"
    >
    <v-expansion-panel
      v-for="(entry, index) in entries"
      :key="`${listKey}-${leaderboardEntryKey(entry)}`"
      :value="leaderboardEntryKey(entry)"
      class="leaderboard-panel"
    >
      <v-expansion-panel-title class="leaderboard-panel-title">
        <span class="rank-badge text-medium-emphasis mr-3">
          {{ index + 1 }}
        </span>
        <span class="text-body-1 flex-grow-1">
          {{ resolveEntryLabel(entry, nameMap) }}
        </span>
        <span class="font-weight-bold ml-3">{{ entry.total }}</span>
      </v-expansion-panel-title>

      <v-expansion-panel-text>
        <div v-if="isHistoryLoading(entry)" class="py-4">
          <v-skeleton-loader type="table-row@3" />
        </div>

        <v-alert
          v-else-if="historyErrorFor(entry)"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-0"
          :text="historyErrorFor(entry)"
        />

        <template v-else-if="historyFor(entry)">
          <p
            v-if="historyFor(entry).votes.length === 0"
            class="text-body-2 text-medium-emphasis text-center py-4 mb-0"
          >
            No votes recorded.
          </p>

          <template v-else>
            <v-table density="compact" class="vote-history-table bg-transparent">
              <thead>
                <tr>
                  <th class="text-left">When</th>
                  <th class="text-left">Voter</th>
                  <th class="text-right">Vote</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="vote in paginatedVotes(entry)"
                  :key="vote.id"
                >
                  <td class="text-body-2">{{ formatTimestamp(vote.timestamp) }}</td>
                  <td class="text-body-2">
                    {{ resolveVoterLabel(vote.voterPlatformId, voterNameMapFor(entry)) }}
                  </td>
                  <td
                    class="text-body-2 text-right font-weight-bold"
                    :class="vote.value > 0 ? 'text-success' : 'text-error'"
                  >
                    {{ vote.value > 0 ? "+" : "" }}{{ vote.value }}
                  </td>
                </tr>
              </tbody>
            </v-table>

            <div
              v-if="totalHistoryPages(entry) > 1"
              class="d-flex justify-center mt-4"
            >
              <v-pagination
                :model-value="historyPageFor(entry)"
                :length="totalHistoryPages(entry)"
                density="compact"
                total-visible="7"
                @update:model-value="setHistoryPage(entry, $event)"
              />
            </div>

            <p class="text-caption text-medium-emphasis text-center mt-2 mb-0">
              {{ historyFor(entry).votes.length }} vote{{
                historyFor(entry).votes.length === 1 ? "" : "s"
              }}
              total
            </p>
          </template>
        </template>
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import {
  VOTE_HISTORY_PAGE_SIZE,
  fetchPlusPlusVoteHistory,
  fetchUserMappingsForPlatformIds,
  leaderboardEntryKey,
  resolveEntryLabel,
  resolveVoterLabel,
} from "../lib/plusplusRankings.js";

const props = defineProps({
  /** Leaderboard rows to render. */
  entries: {
    type: Array,
    default: () => [],
  },
  /** Platform user id → display name (entry labels). */
  nameMap: {
    type: Map,
    required: true,
  },
  /** True while the parent leaderboard list is loading. */
  loading: {
    type: Boolean,
    default: false,
  },
  /** Unique prefix for skeleton keys when top vs bottom. */
  listKey: {
    type: String,
    required: true,
  },
  /** Number of skeleton rows shown during loading. */
  skeletonCount: {
    type: Number,
    default: 20,
  },
});

const expandedKey = ref(null);
/** @type {import('vue').Ref<Map<string, { votes: Array<object>, total: number, voterNameMap: Map<string, string> }>>} */
const historyCache = ref(new Map());
/** @type {import('vue').Ref<string|null>} */
const historyLoadingKey = ref(null);
/** @type {import('vue').Ref<Map<string, string>>} */
const historyErrors = ref(new Map());
/** @type {import('vue').Ref<Map<string, number>>} */
const historyPages = ref(new Map());

watch(expandedKey, (key) => {
  if (!key) return;
  const entry = props.entries.find((row) => leaderboardEntryKey(row) === key);
  if (entry) loadVoteHistory(entry);
});

/**
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @returns {string}
 */
function entryKey(entry) {
  return leaderboardEntryKey(entry);
}

/**
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @returns {boolean}
 */
function isHistoryLoading(entry) {
  return historyLoadingKey.value === entryKey(entry);
}

/**
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @returns {string|undefined}
 */
function historyErrorFor(entry) {
  return historyErrors.value.get(entryKey(entry));
}

/**
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @returns {{ votes: Array<object>, total: number, voterNameMap: Map<string, string> }|undefined}
 */
function historyFor(entry) {
  return historyCache.value.get(entryKey(entry));
}

/**
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @returns {Map<string, string>}
 */
function voterNameMapFor(entry) {
  return historyFor(entry)?.voterNameMap ?? props.nameMap;
}

/**
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @returns {number}
 */
function historyPageFor(entry) {
  return historyPages.value.get(entryKey(entry)) ?? 1;
}

/**
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @param {number} page 1-based page index.
 * @returns {void}
 */
function setHistoryPage(entry, page) {
  const key = entryKey(entry);
  const next = new Map(historyPages.value);
  next.set(key, page);
  historyPages.value = next;
}

/**
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @returns {number}
 */
function totalHistoryPages(entry) {
  const history = historyFor(entry);
  if (!history) return 1;
  return Math.max(1, Math.ceil(history.votes.length / VOTE_HISTORY_PAGE_SIZE));
}

/**
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @returns {Array<object>}
 */
function paginatedVotes(entry) {
  const history = historyFor(entry);
  if (!history) return [];
  const page = historyPageFor(entry);
  const start = (page - 1) * VOTE_HISTORY_PAGE_SIZE;
  return history.votes.slice(start, start + VOTE_HISTORY_PAGE_SIZE);
}

/**
 * @param {string|Date|null|undefined} timestamp Vote timestamp from webapi.
 * @returns {string}
 */
function formatTimestamp(timestamp) {
  if (timestamp == null) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp);
  return date.toLocaleString();
}

/**
 * Fetch vote history and resolve voter names when a panel is expanded.
 * @param {{ string: string, typestr: string }} entry Leaderboard row.
 * @returns {Promise<void>}
 */
async function loadVoteHistory(entry) {
  const key = entryKey(entry);
  if (historyCache.value.has(key) || historyLoadingKey.value === key) return;

  historyLoadingKey.value = key;
  const nextErrors = new Map(historyErrors.value);
  nextErrors.delete(key);
  historyErrors.value = nextErrors;

  try {
    const history = await fetchPlusPlusVoteHistory(entry.string, entry.typestr);
    const voterIds = [
      ...new Set(
        history.votes
          .map((vote) => vote.voterPlatformId)
          .filter((id) => id != null && id !== ""),
      ),
    ];

    const voterNameMap = new Map(props.nameMap);
    const missingIds = voterIds.filter((id) => !voterNameMap.has(String(id)));
    if (missingIds.length > 0) {
      const voterMappings = await fetchUserMappingsForPlatformIds(missingIds);
      for (const row of voterMappings) {
        voterNameMap.set(String(row.platformUserId), String(row.name));
      }
    }

    const nextCache = new Map(historyCache.value);
    nextCache.set(key, {
      votes: history.votes,
      total: history.total,
      voterNameMap,
    });
    historyCache.value = nextCache;

    const nextPages = new Map(historyPages.value);
    nextPages.set(key, 1);
    historyPages.value = nextPages;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load vote history";
    const errors = new Map(historyErrors.value);
    errors.set(key, message);
    historyErrors.value = errors;
  } finally {
    if (historyLoadingKey.value === key) {
      historyLoadingKey.value = null;
    }
  }
}
</script>

<style scoped>
.leaderboard-panels {
  background: transparent;
}

.leaderboard-panel {
  background: transparent;
}

.leaderboard-panel-title {
  padding-inline: 0;
  min-height: 3rem;
}

.rank-badge {
  display: inline-block;
  min-width: 1.5rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.vote-history-table :deep(th) {
  font-weight: 600;
  white-space: nowrap;
}

.vote-history-table :deep(td),
.vote-history-table :deep(th) {
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
