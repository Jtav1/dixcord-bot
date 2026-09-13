<template>
  <div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" :text="error" />

    <v-select
      v-model.number="limit"
      :items="[5, 10, 25, 50]"
      label="Show top/bottom"
      density="comfortable"
      variant="outlined"
      style="max-width: 200px"
      class="mb-4"
      @update:model-value="load"
    />

    <v-skeleton-loader v-if="loading" type="card@2" />

    <v-row v-else>
      <v-col cols="12" md="6">
        <v-card class="glass-card pa-4">
          <v-card-title class="text-h6 pa-0 mb-2">Top Scores</v-card-title>
          <v-list density="compact" class="bg-transparent">
            <v-list-item v-for="(row, i) in top" :key="`top-${i}`">
              <v-list-item-title>
                {{ i + 1 }}. {{ row.string }}
                <v-chip size="x-small" class="ml-1" variant="tonal">{{ row.typestr }}</v-chip>
              </v-list-item-title>
              <template #append>{{ row.total }}</template>
            </v-list-item>
            <v-list-item v-if="!top.length" title="No data yet." />
          </v-list>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card class="glass-card pa-4">
          <v-card-title class="text-h6 pa-0 mb-2">Bottom Scores</v-card-title>
          <v-list density="compact" class="bg-transparent">
            <v-list-item v-for="(row, i) in bottom" :key="`bottom-${i}`">
              <v-list-item-title>
                {{ i + 1 }}. {{ row.string }}
                <v-chip size="x-small" class="ml-1" variant="tonal">{{ row.typestr }}</v-chip>
              </v-list-item-title>
              <template #append>{{ row.total }}</template>
            </v-list-item>
            <v-list-item v-if="!bottom.length" title="No data yet." />
          </v-list>
        </v-card>
      </v-col>
      <v-col cols="12">
        <v-card class="glass-card pa-4">
          <v-card-title class="text-h6 pa-0 mb-2">Top Voters</v-card-title>
          <v-list density="compact" class="bg-transparent">
            <v-list-item v-for="(row, i) in topVoters" :key="`voter-${i}`">
              <template #prepend>
                <span class="mr-2">{{ i + 1 }}.</span>
              </template>
              <UserIdentityDisclosure :mapping="mappingByPlatformId.get(row.voter)" :platform-user-id="row.voter" />
              <template #append>{{ row.total }}</template>
            </v-list-item>
            <v-list-item v-if="!topVoters.length" title="No data yet." />
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import UserIdentityDisclosure from "./UserIdentityDisclosure.vue";
import { fetchPlusplusLeaderboard, fetchPlusplusTopVoters } from "../lib/leaderboards.js";
import { fetchAllGuildMembers } from "../lib/guildMembers.js";

const loading = ref(true);
const error = ref("");
const limit = ref(10);
const top = ref([]);
const bottom = ref([]);
const topVoters = ref([]);
/** @type {import("vue").Ref<Map<string, object>>} guild_members rows (cross-guild, deduplicated) keyed by platformUserId. */
const mappingByPlatformId = ref(new Map());

/**
 * @returns {Promise<void>}
 */
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [scores, voters] = await Promise.all([
      fetchPlusplusLeaderboard({ limit: limit.value }),
      fetchPlusplusTopVoters({ limit: limit.value }),
    ]);
    top.value = scores.top;
    bottom.value = scores.bottom;
    topVoters.value = voters.topVoters;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load leaderboard";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await load();
  try {
    const items = await fetchAllGuildMembers({ app: "discord" });
    mappingByPlatformId.value = new Map(items.map((item) => [item.platformUserId, item]));
  } catch (err) {
    console.warn("Failed to load guild members for top voters:", err);
  }
});
</script>
