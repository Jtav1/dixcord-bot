<template>
  <div class="view-page view-page--narrow">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Emoji Count</h1>
      <p class="text-body-1 text-medium-emphasis">
        See which emojis are used most by dix.
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
        <EmojiLeaderboardTable
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
      v-if="!loading && updatedAt"
      class="text-caption text-medium-emphasis text-center mt-6"
    >
      Updated {{ updatedAt }} · {{ total.toLocaleString() }} emojis tracked
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import EmojiLeaderboardTable from "../components/EmojiLeaderboardTable.vue";
import {
  EMOJI_PAGE_SIZE,
  fetchEmojiLeaderboardPage,
} from "../lib/emojiLeaderboard.js";

const loading = ref(true);
const error = ref("");
const entries = ref([]);
const total = ref(0);
const offset = ref(0);
const page = ref(1);
const updatedAt = ref("");

/**
 * Load one page of emoji leaderboard data from webapi.
 * @param {number} nextPage 1-based page number.
 * @returns {Promise<void>}
 */
async function loadPage(nextPage) {
  loading.value = true;
  error.value = "";

  const safePage = Math.max(1, nextPage);
  const nextOffset = (safePage - 1) * EMOJI_PAGE_SIZE;

  try {
    const result = await fetchEmojiLeaderboardPage(nextOffset);
    entries.value = result.entries;
    total.value = result.total;
    offset.value = result.offset;
    page.value = safePage;
    updatedAt.value = new Date().toLocaleString();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Failed to load emoji leaderboard";
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

onMounted(() => {
  void loadPage(1);
});
</script>
