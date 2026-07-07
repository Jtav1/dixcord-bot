<template>
  <div>
    <template v-if="loading">
      <v-skeleton-loader type="table-heading" class="mb-4" />
      <v-skeleton-loader
        v-for="n in skeletonCount"
        :key="`emoji-skeleton-${n}`"
        type="list-item-two-line"
        class="mb-2"
      />
    </template>

    <p
      v-else-if="entries.length === 0"
      class="text-body-2 text-medium-emphasis text-center py-8"
    >
      No emoji usage yet.
    </p>

    <template v-else>
      <v-table density="comfortable" class="emoji-leaderboard-table bg-transparent">
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
                class="emoji-sample-cell"
                :title="emojiDisplayName(entry)"
              >
                <span
                  v-if="!isCustomDiscordEmoji(entry)"
                  class="emoji-sample emoji-sample--unicode"
                  aria-hidden="true"
                >
                  {{ entry.emoji }}
                </span>
                <v-icon
                  v-else-if="isImageMissing(entry)"
                  icon="mdi-emoticon-outline"
                  size="32"
                  class="text-medium-emphasis"
                  aria-hidden="true"
                />
                <img
                  v-else
                  :src="emojiImageUrl(entry)"
                  :alt="emojiDisplayName(entry)"
                  class="emoji-sample emoji-sample--image"
                  width="32"
                  height="32"
                  @error="markImageMissing(entry)"
                />
              </div>
            </td>
            <td class="text-body-2">{{ emojiDisplayName(entry) }}</td>
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
  EMOJI_PAGE_SIZE,
  emojiDisplayName,
  emojiImageUrl,
  isCustomDiscordEmoji,
} from "../lib/emojiLeaderboard.js";

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
    default: EMOJI_PAGE_SIZE,
  },
});

defineEmits(["update:page"]);

/** Custom emoji image load failures keyed by emoid. */
const missingImageIds = ref(new Set());

/**
 * Total pagination pages from row count and page size.
 * @returns {number}
 */
const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.total / EMOJI_PAGE_SIZE)),
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
 * Record a failed image load for a custom emoji row.
 * @param {{ emoid?: string|number }} entry Emoji leaderboard row.
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
 * Whether a custom emoji image failed to load.
 * @param {{ emoid?: string|number }} entry Emoji leaderboard row.
 * @returns {boolean}
 */
function isImageMissing(entry) {
  return missingImageIds.value.has(String(entry.emoid ?? ""));
}
</script>

<style scoped>
.emoji-leaderboard-table :deep(th),
.emoji-leaderboard-table :deep(td) {
  font-weight: 700;
}

.emoji-leaderboard-table .rank-col {
  width: 4.5rem;
}

.emoji-leaderboard-table .sample-col {
  width: 3.5rem;
}

.emoji-leaderboard-table .frequency-col {
  width: 7rem;
}

.emoji-sample-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.emoji-sample--unicode {
  font-size: 1.75rem;
  line-height: 1;
}

.emoji-sample--image {
  display: block;
  object-fit: contain;
}
</style>
