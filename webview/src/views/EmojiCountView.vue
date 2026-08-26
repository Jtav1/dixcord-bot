<template>
  <div class="view-page view-page--wide">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Emoji Count</h1>
      <p class="text-body-1 text-medium-emphasis">
        See which emojis are used most by dix, and which users use them the most.
      </p>
    </header>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-6"
      :text="error"
    />

    <v-alert
      v-if="userError"
      type="error"
      variant="tonal"
      class="mb-6"
      :text="userError"
    />

    <v-row>
      <v-col cols="12" md="6">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="primary">mdi-emoticon-outline</v-icon>
            Top Emojis
          </v-card-title>
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
      </v-col>

      <v-col cols="12" md="6">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="secondary">mdi-account-group-outline</v-icon>
            Top Emoji Users
          </v-card-title>
          <v-card-text class="pa-0">
            <EmojiUserLeaderboardPanels
              :entries="userEntries"
              :name-map="nameMap"
              :total="userTotal"
              :offset="userOffset"
              :page="userPage"
              :loading="userLoading"
              @update:page="onUserPageChange"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <p
      v-if="!loading && !userLoading && updatedAt"
      class="text-caption text-medium-emphasis text-center mt-6"
    >
      Updated {{ updatedAt }} · {{ total.toLocaleString() }} emojis tracked ·
      {{ userTotal.toLocaleString() }} users ranked
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import EmojiLeaderboardTable from "../components/EmojiLeaderboardTable.vue";
import EmojiUserLeaderboardPanels from "../components/EmojiUserLeaderboardPanels.vue";
import {
  EMOJI_PAGE_SIZE,
  fetchEmojiLeaderboardPage,
  fetchEmojiUserLeaderboardPage,
} from "../lib/emojiLeaderboard.js";
import {
  buildUserNameMap,
  fetchAllUserMappings,
} from "../lib/plusplusRankings.js";

const loading = ref(true);
const error = ref("");
const entries = ref([]);
const total = ref(0);
const offset = ref(0);
const page = ref(1);

const userLoading = ref(true);
const userError = ref("");
const userEntries = ref([]);
const userTotal = ref(0);
const userOffset = ref(0);
const userPage = ref(1);
const nameMap = ref(new Map());

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
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Failed to load emoji leaderboard";
  } finally {
    loading.value = false;
  }
}

/**
 * Load one page of per-user emoji leaderboard data from webapi.
 * @param {number} nextPage 1-based page number.
 * @returns {Promise<void>}
 */
async function loadUserPage(nextPage) {
  userLoading.value = true;
  userError.value = "";

  const safePage = Math.max(1, nextPage);
  const nextOffset = (safePage - 1) * EMOJI_PAGE_SIZE;

  try {
    const result = await fetchEmojiUserLeaderboardPage(nextOffset);
    userEntries.value = result.entries;
    userTotal.value = result.total;
    userOffset.value = result.offset;
    userPage.value = safePage;
  } catch (err) {
    userError.value =
      err instanceof Error
        ? err.message
        : "Failed to load emoji user leaderboard";
  } finally {
    userLoading.value = false;
  }
}

/**
 * Handle pagination control changes for the emoji frequency table.
 * @param {number} nextPage 1-based page number.
 * @returns {void}
 */
function onPageChange(nextPage) {
  void loadPage(nextPage);
}

/**
 * Handle pagination control changes for the user leaderboard.
 * @param {number} nextPage 1-based page number.
 * @returns {void}
 */
function onUserPageChange(nextPage) {
  void loadUserPage(nextPage);
}

onMounted(async () => {
  try {
    const userMappings = await fetchAllUserMappings("discord");
    nameMap.value = buildUserNameMap(userMappings);
  } catch {
    // Name resolution is best-effort; API rows include names as fallback.
  }

  await Promise.all([loadPage(1), loadUserPage(1)]);
  updatedAt.value = new Date().toLocaleString();
});
</script>
