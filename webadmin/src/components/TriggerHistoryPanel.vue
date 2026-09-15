<template>
  <div>
    <v-alert v-if="usersError" type="error" variant="tonal" class="mb-4" :text="usersError" />
    <v-skeleton-loader v-if="usersLoading" type="list-item@4" />

    <v-row v-else>
      <v-col cols="12" md="4">
        <v-card class="glass-card pa-2">
          <v-list nav density="comfortable">
            <v-list-item
              v-for="user in users"
              :key="user.id"
              :active="selectedUser?.id === user.id"
              :title="user.name || user.handle"
              :subtitle="user.handle"
              @click="selectUser(user)"
            />
            <v-list-item v-if="!users.length" title="No trigger-response usage history yet." />
          </v-list>
        </v-card>
      </v-col>

      <v-col cols="12" md="8">
        <PaginatedTable
          v-if="selectedUser"
          :headers="historyHeaders"
          :items="historyItems"
          :loading="historyLoading"
          :error="historyError"
          :page="historyPage"
          :total-pages="historyTotalPages"
          empty-text="No history for this user."
          @update:page="loadHistory"
        >
          <template #cell-timestamp="{ item }">{{ formatTimestamp(item.timestamp) }}</template>
        </PaginatedTable>
        <v-card v-else class="glass-card pa-6 text-medium-emphasis">
          Select a user to view their trigger-response history.
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import PaginatedTable from "./PaginatedTable.vue";
import { usePaginatedResource } from "../composables/usePaginatedResource.js";
import { fetchTriggerHistoryForUser, fetchTriggerHistoryUsers } from "../lib/triggerHistory.js";

const usersLoading = ref(true);
const usersError = ref("");
/** @type {import("vue").Ref<Array<{id:number,name:string,handle:string}>>} */
const users = ref([]);
/** @type {import("vue").Ref<{id:number,name:string,handle:string}|null>} */
const selectedUser = ref(null);

const historyHeaders = [
  { title: "When", key: "timestamp" },
  { title: "Trigger", key: "triggerString" },
  { title: "Response", key: "responseString" },
];

const {
  items: historyItems,
  loading: historyLoading,
  error: historyError,
  page: historyPage,
  totalPages: historyTotalPages,
  load: loadHistory,
} = usePaginatedResource(async ({ limit, offset }) => {
  if (!selectedUser.value) return { items: [], total: 0 };
  const { history, total } = await fetchTriggerHistoryForUser(selectedUser.value.id, {
    limit,
    offset,
  });
  return { items: history, total };
});

/**
 * @param {{id:number,name:string,handle:string}} user
 * @returns {void}
 */
function selectUser(user) {
  selectedUser.value = user;
  void loadHistory(1);
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatTimestamp(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

onMounted(async () => {
  usersLoading.value = true;
  usersError.value = "";
  try {
    users.value = await fetchTriggerHistoryUsers();
  } catch (err) {
    usersError.value = err instanceof Error ? err.message : "Failed to load users";
  } finally {
    usersLoading.value = false;
  }
});
</script>
