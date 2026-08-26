<template>
  <div class="view-page view-page--narrow">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">System Status</h1>
      <p class="text-body-1 text-medium-emphasis">
        Webapi, database, and bot health at a glance
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
        <v-skeleton-loader v-if="loading" type="list-item@4" />

        <v-list v-else-if="status" class="bg-transparent pa-0" lines="two">
          <v-list-item>
            <template #prepend>
              <v-icon :color="statusColor(status.webapi)">mdi-api</v-icon>
            </template>
            <v-list-item-title>Web API</v-list-item-title>
            <v-list-item-subtitle>{{ formatStatus(status.webapi) }}</v-list-item-subtitle>
          </v-list-item>

          <v-list-item>
            <template #prepend>
              <v-icon :color="statusColor(status.db)">mdi-database-outline</v-icon>
            </template>
            <v-list-item-title>Database</v-list-item-title>
            <v-list-item-subtitle>{{ formatStatus(status.db) }}</v-list-item-subtitle>
          </v-list-item>

          <v-list-item>
            <template #prepend>
              <v-icon color="primary">mdi-cached</v-icon>
            </template>
            <v-list-item-title>Cache Version</v-list-item-title>
            <v-list-item-subtitle>{{ status.cacheVersion }}</v-list-item-subtitle>
          </v-list-item>

          <v-divider class="my-2" />

          <v-list-item v-if="status.bot">
            <template #prepend>
              <v-icon :color="status.bot.online ? 'success' : 'warning'">
                mdi-robot-outline
              </v-icon>
            </template>
            <v-list-item-title>
              Bot
              <v-chip
                class="ml-2"
                size="x-small"
                :color="status.bot.online ? 'success' : 'warning'"
                variant="tonal"
              >
                {{ status.bot.online ? "Online" : "Offline" }}
              </v-chip>
            </v-list-item-title>
            <v-list-item-subtitle>
              Version {{ status.bot.version }} · Guild {{ status.bot.guildId }}
            </v-list-item-subtitle>
            <v-list-item-subtitle class="mt-1">
              Last seen {{ formatTimestamp(status.bot.lastSeenAt) }}
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item v-else>
            <template #prepend>
              <v-icon color="medium-emphasis">mdi-robot-off-outline</v-icon>
            </template>
            <v-list-item-title>Bot</v-list-item-title>
            <v-list-item-subtitle>No heartbeat recorded</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

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
import { fetchSystemStatus } from "../lib/systemStatus.js";

const loading = ref(true);
const error = ref("");
/** @type {import("vue").Ref<{ webapi: string, db: string, cacheVersion: string, bot: { guildId: string, version: string, lastSeenAt: string, online: boolean } | null } | null>} */
const status = ref(null);
const updatedAt = ref("");

/**
 * Map a status string to a Vuetify color token.
 * @param {string} value Status value (e.g. "ok", "error").
 * @returns {string} Vuetify color name.
 */
function statusColor(value) {
  return value === "ok" ? "success" : "error";
}

/**
 * Format a status string for display.
 * @param {string} value Status value.
 * @returns {string} Human-readable label.
 */
function formatStatus(value) {
  return value === "ok" ? "Operational" : "Error";
}

/**
 * Format an ISO timestamp for display.
 * @param {string} iso ISO date string.
 * @returns {string} Locale-formatted date/time.
 */
function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/**
 * Load system status from webapi.
 * @returns {Promise<void>}
 */
async function loadStatus() {
  loading.value = true;
  error.value = "";

  try {
    status.value = await fetchSystemStatus();
    updatedAt.value = new Date().toLocaleString();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Failed to load system status";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadStatus();
});
</script>
