<template>
  <div class="view-page">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Pin Archive</h1>
      <p class="text-body-1 text-medium-emphasis">
        Browse pinned messages recorded in the dixbot archives
      </p>
    </header>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-6"
      :text="error"
    />

    <v-card class="glass-card pa-6">
      <v-card-text class="pa-0">
        <PinArchiveList
          :entries="entries"
          :total="total"
          :offset="offset"
          :page="page"
          :loading="loading"
          :name-map="nameMap"
          :platform-name-map="platformNameMap"
          @update:page="onPageChange"
        />
      </v-card-text>
    </v-card>

    <p
      v-if="!loading && updatedAt"
      class="text-caption text-medium-emphasis text-center mt-6"
    >
      Updated {{ updatedAt }} · {{ total.toLocaleString() }} pin{{
        total === 1 ? "" : "s"
      }}
      recorded
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import PinArchiveList from "../components/PinArchiveList.vue";
import {
  PIN_PAGE_SIZE,
  buildMappingIdNameMap,
  fetchPinHistoryPage,
} from "../lib/pinArchive.js";
import { fetchAllUserMappings, buildUserNameMap } from "../lib/plusplusRankings.js";

const loading = ref(true);
const error = ref("");
const entries = ref([]);
const total = ref(0);
const offset = ref(0);
const page = ref(1);
const nameMap = ref(new Map());
const platformNameMap = ref(new Map());
const updatedAt = ref("");

/**
 * Load one page of pin history from webapi.
 * @param {number} nextPage 1-based page number.
 * @returns {Promise<void>}
 */
async function loadPage(nextPage) {
  loading.value = true;
  error.value = "";

  const safePage = Math.max(1, nextPage);
  const nextOffset = (safePage - 1) * PIN_PAGE_SIZE;

  try {
    const result = await fetchPinHistoryPage(nextOffset);
    entries.value = result.entries;
    total.value = result.total;
    offset.value = result.offset;
    page.value = safePage;
    updatedAt.value = new Date().toLocaleString();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Failed to load pin history";
  } finally {
    loading.value = false;
  }
}

/**
 * Handle pagination control changes.
 * @param {number} nextPage 1-based page number.
 * @returns {void}
 */
function onPageChange(nextPage) {
  void loadPage(nextPage);
}

onMounted(async () => {
  try {
    const userMappings = await fetchAllUserMappings("discord");
    nameMap.value = buildMappingIdNameMap(userMappings);
    platformNameMap.value = buildUserNameMap(userMappings);
  } catch {
    // Name resolution is best-effort.
  }

  await loadPage(1);
});
</script>
