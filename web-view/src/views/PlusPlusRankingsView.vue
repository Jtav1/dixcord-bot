<template>
  <div class="view-page">
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
            <template v-if="loading">
              <v-skeleton-loader
                v-for="n in LEADERBOARD_LIMIT"
                :key="`top-skeleton-${n}`"
                type="list-item-two-line"
                class="mb-2"
              />
            </template>
            <template v-else-if="top.length === 0">
              <p class="text-body-2 text-medium-emphasis text-center py-8">
                No scores yet.
              </p>
            </template>
            <v-list v-else class="pa-0 bg-transparent" density="comfortable">
              <v-list-item
                v-for="(entry, index) in top"
                :key="`top-${entry.string}-${entry.typestr}`"
                class="px-0"
              >
                <template #prepend>
                  <span class="rank-badge text-medium-emphasis mr-3">
                    {{ index + 1 }}
                  </span>
                </template>
                <v-list-item-title>
                  {{ resolveEntryLabel(entry, nameMap) }}
                </v-list-item-title>
                <template #append>
                  <span class="font-weight-bold">{{ entry.total }}</span>
                </template>
              </v-list-item>
            </v-list>
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
            <template v-if="loading">
              <v-skeleton-loader
                v-for="n in LEADERBOARD_LIMIT"
                :key="`bottom-skeleton-${n}`"
                type="list-item-two-line"
                class="mb-2"
              />
            </template>
            <template v-else-if="bottom.length === 0">
              <p class="text-body-2 text-medium-emphasis text-center py-8">
                No scores yet.
              </p>
            </template>
            <v-list v-else class="pa-0 bg-transparent" density="comfortable">
              <v-list-item
                v-for="(entry, index) in bottom"
                :key="`bottom-${entry.string}-${entry.typestr}`"
                class="px-0"
              >
                <template #prepend>
                  <span class="rank-badge text-medium-emphasis mr-3">
                    {{ index + 1 }}
                  </span>
                </template>
                <v-list-item-title>
                  {{ resolveEntryLabel(entry, nameMap) }}
                </v-list-item-title>
                <template #append>
                  <span class="font-weight-bold">{{ entry.total }}</span>
                </template>
              </v-list-item>
            </v-list>
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
import {
  LEADERBOARD_LIMIT,
  buildUserNameMap,
  fetchAllUserMappings,
  fetchPlusPlusLeaderboard,
  resolveEntryLabel,
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

<style scoped>
.rank-badge {
  display: inline-block;
  min-width: 1.5rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
