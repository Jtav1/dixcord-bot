<template>
  <div>
    <template v-if="loading">
      <v-skeleton-loader
        v-for="n in skeletonCount"
        :key="`sticker-user-skeleton-${n}`"
        type="list-item-two-line"
        class="mb-2"
      />
    </template>

    <p
      v-else-if="entries.length === 0"
      class="text-body-2 text-medium-emphasis text-center py-8"
    >
      No sticker usage by users yet.
    </p>

    <template v-else>
      <v-expansion-panels
        v-model="expandedKey"
        variant="accordion"
        class="leaderboard-panels"
      >
        <v-expansion-panel
          v-for="(entry, index) in entries"
          :key="entry.userid"
          :value="entry.userid"
          class="leaderboard-panel"
        >
          <v-expansion-panel-title class="leaderboard-panel-title">
            <span class="rank-badge text-medium-emphasis mr-3">
              {{ offset + index + 1 }}
            </span>
            <span class="text-body-1 flex-grow-1">
              {{ resolveUserLabel(entry, nameMap) }}
            </span>
            <span class="font-weight-bold ml-3">
              {{ formatFrequency(entry.total) }}
            </span>
          </v-expansion-panel-title>

          <v-expansion-panel-text>
            <div v-if="isStatsLoading(entry)" class="py-4">
              <v-skeleton-loader type="table-row@3" />
            </div>

            <v-alert
              v-else-if="statsErrorFor(entry)"
              type="error"
              variant="tonal"
              density="compact"
              class="mb-0"
              :text="statsErrorFor(entry)"
            />

            <template v-else-if="statsFor(entry)">
              <p
                v-if="statsFor(entry).length === 0"
                class="text-body-2 text-medium-emphasis text-center py-4 mb-0"
              >
                No stickers recorded.
              </p>

              <template v-else>
                <v-table
                  density="compact"
                  class="sticker-stats-table bg-transparent"
                >
                  <thead>
                    <tr>
                      <th class="text-left sample-col">Sample</th>
                      <th class="text-left">Name</th>
                      <th class="text-right frequency-col">Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in statsFor(entry)"
                      :key="row.emoid"
                    >
                      <td class="sample-col">
                        <div
                          class="sticker-sample-cell"
                          :title="stickerDisplayName(row)"
                        >
                          <v-icon
                            v-if="isImageMissing(row)"
                            icon="mdi-sticker-emoji"
                            size="24"
                            class="text-medium-emphasis"
                            aria-hidden="true"
                          />
                          <img
                            v-else
                            :src="stickerImageUrl(row)"
                            :alt="stickerDisplayName(row)"
                            class="sticker-sample-image"
                            width="24"
                            height="24"
                            @error="markImageMissing(row)"
                          />
                        </div>
                      </td>
                      <td class="text-body-2">{{ stickerDisplayName(row) }}</td>
                      <td class="text-body-2 text-right frequency-col">
                        {{ formatFrequency(row.frequency) }}
                      </td>
                    </tr>
                  </tbody>
                </v-table>

                <p class="text-caption text-medium-emphasis text-center mt-2 mb-0">
                  {{ statsFor(entry).length }} sticker{{
                    statsFor(entry).length === 1 ? "" : "s"
                  }}
                  total
                </p>
              </template>
            </template>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <div
        v-if="totalPages > 1"
        class="d-flex justify-center mt-4"
      >
        <v-pagination
          :model-value="page"
          :length="totalPages"
          density="compact"
          total-visible="7"
          @update:model-value="$emit('update:page', $event)"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import {
  STICKER_USER_PAGE_SIZE,
  fetchUserStickerStats,
  resolveUserLabel,
  stickerDisplayName,
  stickerImageUrl,
} from "../lib/stickerLeaderboard.js";

const props = defineProps({
  /** User leaderboard rows to render. */
  entries: {
    type: Array,
    default: () => [],
  },
  /** Platform user id → display name. */
  nameMap: {
    type: Map,
    required: true,
  },
  /** True while the parent leaderboard list is loading. */
  loading: {
    type: Boolean,
    default: false,
  },
  /** Total row count across all pages. */
  total: {
    type: Number,
    default: 0,
  },
  /** Rows skipped on the current page. */
  offset: {
    type: Number,
    default: 0,
  },
  /** Current 1-based page index. */
  page: {
    type: Number,
    default: 1,
  },
  /** Number of skeleton rows shown during loading. */
  skeletonCount: {
    type: Number,
    default: STICKER_USER_PAGE_SIZE,
  },
});

defineEmits(["update:page"]);

const expandedKey = ref(null);
/** @type {import('vue').Ref<Map<string, Array<object>>>} */
const statsCache = ref(new Map());
/** @type {import('vue').Ref<string|null>} */
const statsLoadingKey = ref(null);
/** @type {import('vue').Ref<Map<string, string>>} */
const statsErrors = ref(new Map());
/** Sticker image load failures keyed by emoid. */
const missingImageIds = ref(new Set());

/**
 * Total pagination pages from row count and page size.
 * @returns {number}
 */
const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.total / STICKER_USER_PAGE_SIZE)),
);

watch(
  () => props.entries,
  () => {
    expandedKey.value = null;
    missingImageIds.value = new Set();
  },
);

watch(expandedKey, (key) => {
  if (!key) return;
  const entry = props.entries.find((row) => row.userid === key);
  if (entry) void loadUserStickerStats(entry);
});

/**
 * @param {{ userid?: string }} entry User leaderboard row.
 * @returns {string}
 */
function entryKey(entry) {
  return String(entry.userid ?? "");
}

/**
 * @param {{ userid?: string }} entry User leaderboard row.
 * @returns {boolean}
 */
function isStatsLoading(entry) {
  return statsLoadingKey.value === entryKey(entry);
}

/**
 * @param {{ userid?: string }} entry User leaderboard row.
 * @returns {string|undefined}
 */
function statsErrorFor(entry) {
  return statsErrors.value.get(entryKey(entry));
}

/**
 * @param {{ userid?: string }} entry User leaderboard row.
 * @returns {Array<object>|undefined}
 */
function statsFor(entry) {
  return statsCache.value.get(entryKey(entry));
}

/**
 * Format frequency for display.
 * @param {number|string} value Raw frequency.
 * @returns {string}
 */
function formatFrequency(value) {
  return Number(value).toLocaleString();
}

/**
 * Record a failed image load for a sticker row.
 * @param {{ emoid?: string|number }} row Sticker stats row.
 * @returns {void}
 */
function markImageMissing(row) {
  const id = String(row.emoid ?? "");
  if (!id) return;
  const next = new Set(missingImageIds.value);
  next.add(id);
  missingImageIds.value = next;
}

/**
 * Whether a sticker image failed to load.
 * @param {{ emoid?: string|number }} row Sticker stats row.
 * @returns {boolean}
 */
function isImageMissing(row) {
  return missingImageIds.value.has(String(row.emoid ?? ""));
}

/**
 * Fetch per-user sticker frequencies when a panel is expanded.
 * @param {{ userid?: string }} entry User leaderboard row.
 * @returns {Promise<void>}
 */
async function loadUserStickerStats(entry) {
  const key = entryKey(entry);
  if (statsCache.value.has(key) || statsLoadingKey.value === key) return;

  statsLoadingKey.value = key;
  const nextErrors = new Map(statsErrors.value);
  nextErrors.delete(key);
  statsErrors.value = nextErrors;

  try {
    const stats = await fetchUserStickerStats(key);
    const nextCache = new Map(statsCache.value);
    nextCache.set(key, stats);
    statsCache.value = nextCache;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load user sticker stats";
    const errors = new Map(statsErrors.value);
    errors.set(key, message);
    statsErrors.value = errors;
  } finally {
    if (statsLoadingKey.value === key) {
      statsLoadingKey.value = null;
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

.sticker-stats-table :deep(th) {
  font-weight: 600;
  white-space: nowrap;
}

.sticker-stats-table :deep(td),
.sticker-stats-table :deep(th) {
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.sticker-stats-table .sample-col {
  width: 3rem;
}

.sticker-stats-table .frequency-col {
  width: 7rem;
}

.sticker-sample-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.sticker-sample-image {
  display: block;
  object-fit: contain;
}
</style>
