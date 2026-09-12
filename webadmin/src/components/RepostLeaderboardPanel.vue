<template>
  <div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" :text="error" />

    <v-select
      v-model.number="limit"
      :items="[5, 10, 25, 50]"
      label="Show top"
      density="comfortable"
      variant="outlined"
      style="max-width: 200px"
      class="mb-4"
      @update:model-value="load"
    />

    <v-skeleton-loader v-if="loading" type="list-item@6" />
    <v-card v-else class="glass-card pa-4">
      <v-list density="compact" class="bg-transparent">
        <v-list-item v-for="(row, i) in top" :key="i">
          <v-list-item-title>{{ i + 1 }}. {{ row.userid }}</v-list-item-title>
          <template #append>{{ row.count }}</template>
        </v-list-item>
        <v-list-item v-if="!top.length" title="No repost accusations yet." />
      </v-list>
    </v-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { fetchRepostLeaderboard } from "../lib/leaderboards.js";

const loading = ref(true);
const error = ref("");
const limit = ref(10);
const top = ref([]);

/**
 * @returns {Promise<void>}
 */
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await fetchRepostLeaderboard({ limit: limit.value });
    top.value = data.top;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load leaderboard";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
