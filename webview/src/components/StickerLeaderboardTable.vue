<template>
  <div>
    <template v-if="loading">
      <v-skeleton-loader type="table-heading" class="mb-4" />
      <v-skeleton-loader
        v-for="n in skeletonCount"
        :key="`sticker-skeleton-${n}`"
        type="list-item-two-line"
        class="mb-2"
      />
    </template>

    <p
      v-else-if="entries.length === 0"
      class="text-body-2 text-medium-emphasis text-center py-8"
    >
      No sticker usage yet.
    </p>

    <template v-else>
      <v-table density="comfortable" class="sticker-leaderboard-table bg-transparent">
        <thead>
          <tr>
            <th class="text-left rank-col">Rank</th>
            <th class="text-left sample-col">Sample</th>
            <th class="text-left">Name</th>
            <th class="text-right frequency-col">Frequency</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, index) in entries" :key="entry.emoid">
            <td class="text-body-2 rank-col">
              {{ offset + index + 1 }}
            </td>
            <td class="sample-col">
              <div
                class="sticker-sample-cell"
                :title="stickerDisplayName(entry)"
              >
                <v-icon
                  v-if="isImageMissing(entry)"
                  icon="mdi-sticker-emoji"
                  size="32"
                  class="text-medium-emphasis"
                  aria-hidden="true"
                />
                <img
                  v-else
                  :src="stickerImageUrl(entry)"
                  :alt="stickerDisplayName(entry)"
                  class="sticker-sample-image"
                  width="32"
                  height="32"
                  @error="markImageMissing(entry)"
                />
              </div>
            </td>
            <td class="text-body-2">{{ stickerDisplayName(entry) }}</td>
            <td class="text-body-2 text-right frequency-col">
              {{ formatFrequency(entry.frequency) }}
            </td>
          </tr>
        </tbody>
      </v-table>

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
  STICKER_PAGE_SIZE,
  stickerDisplayName,
  stickerImageUrl,
} from "../lib/stickerLeaderboard.js";

const props = defineProps({
  entries: {
    type: Array,
    default: () => [],
  },
  total: {
    type: Number,
    default: 0,
  },
  offset: {
    type: Number,
    default: 0,
  },
  page: {
    type: Number,
    default: 1,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  skeletonCount: {
    type: Number,
    default: STICKER_PAGE_SIZE,
  },
});

defineEmits(["update:page"]);

/** Sticker image load failures keyed by emoid. */
const missingImageIds = ref(new Set());

/**
 * Total pagination pages from row count and page size.
 * @returns {number}
 */
const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.total / STICKER_PAGE_SIZE)),
);

watch(
  () => props.entries,
  () => {
    missingImageIds.value = new Set();
  },
);

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
 * @param {{ emoid?: string|number }} entry Sticker leaderboard row.
 * @returns {void}
 */
function markImageMissing(entry) {
  const id = String(entry.emoid ?? "");
  if (!id) return;
  const next = new Set(missingImageIds.value);
  next.add(id);
  missingImageIds.value = next;
}

/**
 * Whether a sticker image failed to load.
 * @param {{ emoid?: string|number }} entry Sticker leaderboard row.
 * @returns {boolean}
 */
function isImageMissing(entry) {
  return missingImageIds.value.has(String(entry.emoid ?? ""));
}
</script>

<style scoped>
.sticker-leaderboard-table :deep(th),
.sticker-leaderboard-table :deep(td) {
  font-weight: 700;
}

.sticker-leaderboard-table .rank-col {
  width: 4.5rem;
}

.sticker-leaderboard-table .sample-col {
  width: 3.5rem;
}

.sticker-leaderboard-table .frequency-col {
  width: 7rem;
}

.sticker-sample-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.sticker-sample-image {
  display: block;
  object-fit: contain;
}
</style>
