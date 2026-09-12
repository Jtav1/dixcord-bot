<template>
  <div>
    <v-tabs v-model="eventType" color="primary" class="mb-4">
      <v-tab value="plusplus">PlusPlus Events</v-tab>
      <v-tab value="repost">Repost Events</v-tab>
    </v-tabs>

    <PaginatedTable
      v-if="eventType === 'plusplus'"
      :headers="plusplusHeaders"
      :items="plusplusItems"
      :loading="plusplusLoading"
      :error="plusplusError"
      :page="plusplusPage"
      :total-pages="plusplusTotalPages"
      empty-text="No plusplus events yet."
      @update:page="loadPlusplus"
    >
      <template #cell-timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
    </PaginatedTable>

    <PaginatedTable
      v-else
      :headers="repostHeaders"
      :items="repostItems"
      :loading="repostLoading"
      :error="repostError"
      :page="repostPage"
      :total-pages="repostTotalPages"
      empty-text="No repost events yet."
      @update:page="loadRepost"
    >
      <template #cell-timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
    </PaginatedTable>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import PaginatedTable from "./PaginatedTable.vue";
import { usePaginatedResource } from "../composables/usePaginatedResource.js";
import { fetchPlusplusEvents, fetchRepostEvents } from "../lib/events.js";

const eventType = ref("plusplus");

const plusplusHeaders = [
  { title: "When", key: "timestamp" },
  { title: "Type", key: "type" },
  { title: "Value", key: "string" },
  { title: "Vote", key: "value" },
  { title: "Voter", key: "voterPlatformId" },
];
const repostHeaders = [
  { title: "When", key: "timestamp" },
  { title: "User", key: "useridPlatformId" },
  { title: "Accuser", key: "accuserPlatformId" },
  { title: "Message", key: "msgcontents" },
];

const {
  items: plusplusItems,
  loading: plusplusLoading,
  error: plusplusError,
  page: plusplusPage,
  totalPages: plusplusTotalPages,
  load: loadPlusplus,
} = usePaginatedResource(fetchPlusplusEvents);

const {
  items: repostItems,
  loading: repostLoading,
  error: repostError,
  page: repostPage,
  totalPages: repostTotalPages,
  load: loadRepost,
} = usePaginatedResource(fetchRepostEvents);

/**
 * @param {string} iso
 * @returns {string}
 */
function formatTimestamp(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

watch(eventType, (type) => {
  if (type === "repost" && !repostItems.value.length) void loadRepost(1);
});

onMounted(() => void loadPlusplus(1));
</script>
