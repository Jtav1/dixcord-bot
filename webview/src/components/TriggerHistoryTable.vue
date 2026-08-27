<template>
  <div>
    <template v-if="loading">
      <v-skeleton-loader type="table-heading" class="mb-4" />
      <v-skeleton-loader
        v-for="n in skeletonCount"
        :key="`trigger-history-skeleton-${n}`"
        type="list-item-two-line"
        class="mb-2"
      />
    </template>

    <p
      v-else-if="entries.length === 0"
      class="text-body-2 text-medium-emphasis text-center py-8"
    >
      No trigger-response history recorded yet.
    </p>

    <template v-else>
      <v-table density="comfortable" class="trigger-history-table bg-transparent">
        <thead>
          <tr>
            <th class="text-left timestamp-col">When</th>
            <th class="text-left">Trigger</th>
            <th class="text-left">Response</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.id">
            <td class="text-body-2 text-medium-emphasis timestamp-col">
              {{ formatHistoryTimestamp(entry.timestamp) }}
            </td>
            <td class="text-body-2">{{ entry.triggerString }}</td>
            <td class="text-body-2 response-col">{{ entry.responseString }}</td>
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
import { computed } from "vue";
import {
  TRIGGER_HISTORY_PAGE_SIZE,
  formatHistoryTimestamp,
} from "../lib/triggerHistory.js";

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
    default: TRIGGER_HISTORY_PAGE_SIZE,
  },
});

defineEmits(["update:page"]);

/**
 * Total pagination pages from row count and page size.
 * @returns {number}
 */
const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.total / TRIGGER_HISTORY_PAGE_SIZE)),
);
</script>

<style scoped>
.trigger-history-table :deep(th) {
  font-weight: 700;
}

.trigger-history-table .timestamp-col {
  width: 12rem;
  white-space: nowrap;
}

.trigger-history-table .response-col {
  word-break: break-word;
}
</style>
