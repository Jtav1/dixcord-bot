<template>
  <div class="view-page">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Statistics</h1>
      <p class="text-body-1 text-medium-emphasis">
        Overview of dixbot activity and usage trends
      </p>
    </header>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-6"
      :text="error"
    />

    <v-skeleton-loader v-if="loading" type="card@5" class="mb-6" />

    <v-row v-else-if="statistics">
      <v-col cols="12" sm="6" md="4">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="primary">mdi-account-group-outline</v-icon>
            Members
          </v-card-title>
          <v-card-text class="pa-0 statistics-metrics">
            <p>
              Chat members tracked:
              {{ formatCount(statistics.chatMemberMappings) }}
            </p>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="primary">mdi-emoticon-outline</v-icon>
            Emojis &amp; Stickers
          </v-card-title>
          <v-card-text class="pa-0 statistics-metrics">
            <p class="text-caption text-medium-emphasis mb-2">Catalog</p>
            <p>
              Emojis tracked: {{ formatCount(statistics.emojiCatalog.emojis) }}
            </p>
            <p>
              Stickers tracked:
              {{ formatCount(statistics.emojiCatalog.stickers) }}
            </p>
            <p>
              Total catalog: {{ formatCount(statistics.emojiCatalog.total) }}
            </p>
            <p class="text-caption text-medium-emphasis mb-2 mt-4">Usage</p>
            <p>Emojis used: {{ formatCount(statistics.emojiUsage.emojis) }}</p>
            <p>
              Stickers used: {{ formatCount(statistics.emojiUsage.stickers) }}
            </p>
            <p>Total: {{ formatCount(statistics.emojiUsage.total) }}</p>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="secondary">mdi-plus-minus-variant</v-icon>
            PlusPlus
          </v-card-title>
          <v-card-text class="pa-0 statistics-metrics">
            <p>
              Number of ++/-- votes:
              {{ formatCount(statistics.plusplusTracking) }}
            </p>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="primary">mdi-pin-outline</v-icon>
            Pins &amp; Reposts
          </v-card-title>
          <v-card-text class="pa-0 statistics-metrics">
            <p>
              Messages pinned:
              {{ formatCount(statistics.pinHistory) }}
            </p>
            <p>
              Repost accusations:
              {{ formatCount(statistics.repostTracking) }}
            </p>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="secondary"
              >mdi-message-reply-text-outline</v-icon
            >
            Triggers/Responses
          </v-card-title>
          <v-card-text class="pa-0 statistics-metrics">
            <p>
              Number of trigger phrases: {{ formatCount(statistics.triggers) }}
            </p>
            <p>
              Number of trigger responses:
              {{ formatCount(statistics.responses) }}
            </p>
            <p>
              Number of times a trigger has been called:
              {{ formatCount(statistics.triggerResponseFrequencySum) }}
            </p>
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
import { fetchStatistics } from "../lib/statistics.js";

const loading = ref(true);
const error = ref("");
/** @type {import("vue").Ref<{
 *   chatMemberMappings: number,
 *   emojiCatalog: { emojis: number, stickers: number, total: number },
 *   emojiUsage: { emojis: number, stickers: number, total: number },
 *   pinHistory: number,
 *   plusplusTracking: number,
 *   triggers: number,
 *   responses: number,
 *   triggerResponseFrequencySum: number,
 *   repostTracking: number
 * } | null>} */
const statistics = ref(null);
const updatedAt = ref("");

/**
 * Format a numeric count for display.
 * @param {number} value Count or sum value.
 * @returns {string} Locale-formatted number string.
 */
function formatCount(value) {
  return Number(value).toLocaleString();
}

/**
 * Load aggregate statistics from webapi.
 * @returns {Promise<void>}
 */
async function loadStatistics() {
  loading.value = true;
  error.value = "";

  try {
    statistics.value = await fetchStatistics();
    updatedAt.value = new Date().toLocaleString();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Failed to load statistics";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadStatistics();
});
</script>

<style scoped>
.statistics-metrics p {
  margin: 0 0 0.35rem;
}
</style>
