<template>
  <div class="view-page">
    <header class="view-header mb-6">
      <router-link to="/trigger-history" class="text-body-2 d-inline-flex align-center mb-2">
        <v-icon size="16" class="mr-1" aria-hidden="true">mdi-arrow-left</v-icon>
        Back to all users
      </router-link>
      <h1 class="text-h4 font-weight-bold mb-2">{{ userLabel }}</h1>
      <p class="text-body-1 text-medium-emphasis">
        Trigger-response history
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
        <TriggerHistoryTable
          :entries="entries"
          :total="total"
          :offset="offset"
          :page="page"
          :loading="loading"
          @update:page="onPageChange"
        />
      </v-card-text>
    </v-card>

    <p
      v-if="!loading && !userLoading"
      class="text-caption text-medium-emphasis text-center mt-6"
    >
      {{ total.toLocaleString() }} recorded trigger response{{ total === 1 ? "" : "s" }}
    </p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import TriggerHistoryTable from "../components/TriggerHistoryTable.vue";
import {
  TRIGGER_HISTORY_PAGE_SIZE,
  fetchTriggerResponseHistoryPage,
} from "../lib/triggerHistory.js";
import { fetchAllUserMappings } from "../lib/plusplusRankings.js";
import { buildMappingIdNameMap } from "../lib/pinArchive.js";

const route = useRoute();

const loading = ref(true);
const error = ref("");
const entries = ref([]);
const total = ref(0);
const offset = ref(0);
const page = ref(1);

const userLoading = ref(true);
const userName = ref("");

const chatMemberId = computed(() => route.params.id);

const userLabel = computed(() =>
  userName.value ? userName.value : `User #${chatMemberId.value}`,
);

/**
 * Load one page of trigger-response history for the current user from webapi.
 * @param {number} nextPage 1-based page number.
 * @returns {Promise<void>}
 */
async function loadPage(nextPage) {
  loading.value = true;
  error.value = "";

  const safePage = Math.max(1, nextPage);
  const nextOffset = (safePage - 1) * TRIGGER_HISTORY_PAGE_SIZE;

  try {
    const result = await fetchTriggerResponseHistoryPage(
      chatMemberId.value,
      nextOffset,
    );
    entries.value = result.entries;
    total.value = result.total;
    offset.value = result.offset;
    page.value = safePage;
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Failed to load trigger-response history";
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

/**
 * Resolve the current user's display name from the full user mapping list.
 * @returns {Promise<void>}
 */
async function loadUserName() {
  userLoading.value = true;
  try {
    const userMappings = await fetchAllUserMappings("discord");
    const nameMap = buildMappingIdNameMap(userMappings);
    userName.value = nameMap.get(Number(chatMemberId.value)) ?? "";
  } catch {
    // Name resolution is best-effort; falls back to "User #<id>".
  } finally {
    userLoading.value = false;
  }
}

watch(chatMemberId, () => {
  void loadUserName();
  void loadPage(1);
});

onMounted(async () => {
  await Promise.all([loadUserName(), loadPage(1)]);
});
</script>
