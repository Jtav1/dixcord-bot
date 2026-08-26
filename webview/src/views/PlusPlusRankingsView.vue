<template>
  <div class="view-page view-page--wide">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">PlusPlus Rankings</h1>
      <p class="text-body-1 text-medium-emphasis">
        Top and bottom {{ LEADERBOARD_LIMIT }} plusplus scoreboards
      </p>
    </header>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-6"
      :text="error"
    />

    <v-row>
      <v-col cols="12" md="6">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="primary">mdi-trophy-outline</v-icon>
            Top Scores
          </v-card-title>
          <v-card-text class="pa-0">
            <PlusPlusLeaderboardPanels
              list-key="top"
              :entries="top"
              :name-map="nameMap"
              :loading="loading"
              :skeleton-count="LEADERBOARD_LIMIT"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="secondary">mdi-arrow-down-bold-outline</v-icon>
            Bottom Scores
          </v-card-title>
          <v-card-text class="pa-0">
            <PlusPlusLeaderboardPanels
              list-key="bottom"
              :entries="bottom"
              :name-map="nameMap"
              :loading="loading"
              :skeleton-count="LEADERBOARD_LIMIT"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <p
      v-if="!loading && updatedAt"
      class="text-caption text-medium-emphasis text-center mt-6"
    >
      Updated {{ updatedAt }}
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import PlusPlusLeaderboardPanels from "../components/PlusPlusLeaderboardPanels.vue";
import {
  LEADERBOARD_LIMIT,
  buildUserNameMap,
  fetchAllUserMappings,
  fetchPlusPlusLeaderboard,
} from "../lib/plusplusRankings.js";

const loading = ref(true);
const error = ref("");
const top = ref([]);
const bottom = ref([]);
const nameMap = ref(new Map());
const updatedAt = ref("");

/**
 * Load leaderboard data and user mappings from webapi.
 * @returns {Promise<void>}
 */
async function loadRankings() {
  loading.value = true;
  error.value = "";

  try {
    const [leaderboard, userMappings] = await Promise.all([
      fetchPlusPlusLeaderboard(LEADERBOARD_LIMIT),
      fetchAllUserMappings("discord"),
    ]);

    top.value = leaderboard.top;
    bottom.value = leaderboard.bottom;
    nameMap.value = buildUserNameMap(userMappings);
    updatedAt.value = new Date().toLocaleString();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Failed to load rankings";
  } finally {
    loading.value = false;
  }
}

onMounted(loadRankings);
</script>
