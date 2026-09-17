<template>
  <div class="view-page">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Timeout Votes</h1>
      <p class="text-body-1 text-medium-emphasis">
        Users timed out by community reaction vote
      </p>
    </header>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-6" :text="error" />

    <v-card class="glass-card pa-6">
      <v-card-text class="pa-0">
        <TimeoutHistoryPanels
          :entries="entries"
          :total="total"
          :page="page"
          :loading="loading"
          :identity-map="identityMap"
          @update:page="onPageChange"
        />
      </v-card-text>
    </v-card>

    <p v-if="!loading && updatedAt" class="text-caption text-medium-emphasis text-center mt-6">
      Updated {{ updatedAt }} · {{ total.toLocaleString() }} timeout{{ total === 1 ? "" : "s" }} recorded
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import TimeoutHistoryPanels from "../components/TimeoutHistoryPanels.vue";
import { TIMEOUT_HISTORY_PAGE_SIZE, fetchTimeoutHistoryPage } from "../lib/timeoutVotes.js";
import { fetchAllGuildMembers } from "../lib/plusplusRankings.js";
import { buildIdentityMapByMappingId } from "../lib/userIdentity.js";

const loading = ref(true);
const error = ref("");
const entries = ref([]);
const total = ref(0);
const page = ref(1);
const identityMap = ref(new Map());
const updatedAt = ref("");

/**
 * Load one page of timeout history from webapi.
 * @param {number} nextPage 1-based page number.
 * @returns {Promise<void>}
 */
async function loadPage(nextPage) {
  loading.value = true;
  error.value = "";

  const safePage = Math.max(1, nextPage);
  const offset = (safePage - 1) * TIMEOUT_HISTORY_PAGE_SIZE;

  try {
    const result = await fetchTimeoutHistoryPage(offset);
    entries.value = result.entries;
    total.value = result.total;
    page.value = safePage;
    updatedAt.value = new Date().toLocaleString();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load timeout history";
  } finally {
    loading.value = false;
  }
}

/**
 * @param {number} nextPage 1-based page number.
 * @returns {void}
 */
function onPageChange(nextPage) {
  void loadPage(nextPage);
}

onMounted(async () => {
  try {
    const members = await fetchAllGuildMembers("discord");
    identityMap.value = buildIdentityMapByMappingId(members);
  } catch {
    // Name resolution is best-effort.
  }

  await loadPage(1);
});
</script>
