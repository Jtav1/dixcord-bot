<template>
  <div class="view-page">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Dashboard</h1>
      <p class="text-body-1 text-medium-emphasis">
        Webapi, database, and bot health, plus overall activity at a glance
      </p>
    </header>

    <v-alert
      v-if="statusError"
      type="error"
      variant="tonal"
      class="mb-6"
      :text="statusError"
    />

    <v-card class="glass-card pa-6 mb-6">
      <v-card-title class="text-h6 pa-0 mb-4">System Status</v-card-title>
      <v-card-text class="pa-0">
        <v-skeleton-loader v-if="statusLoading" type="list-item@4" />

        <v-list v-else-if="status" class="bg-transparent pa-0" lines="two">
          <v-list-item>
            <template #prepend>
              <v-icon :color="statusColor(status.webapi)">mdi-api</v-icon>
            </template>
            <v-list-item-title>Web API</v-list-item-title>
            <v-list-item-subtitle>{{ formatStatus(status.webapi) }}</v-list-item-subtitle>
            <v-list-item-subtitle class="mt-1">
              Up {{ formatDuration(status.webapiUptimeSeconds) }} · Memory
              {{ formatBytes(status.webapiMemoryRssBytes) }}
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item>
            <template #prepend>
              <v-icon :color="statusColor(status.db)">mdi-database-outline</v-icon>
            </template>
            <v-list-item-title>Database</v-list-item-title>
            <v-list-item-subtitle>
              {{ formatStatus(status.db) }} ({{ status.dbType }})
            </v-list-item-subtitle>
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
            <v-list-item-subtitle v-if="status.bot.uptimeSeconds != null" class="mt-1">
              Up {{ formatDuration(status.bot.uptimeSeconds) }}
            </v-list-item-subtitle>
            <v-list-item-subtitle
              v-if="status.bot.memberCount != null || status.bot.channelCount != null"
              class="mt-1"
            >
              <template v-if="status.bot.memberCount != null">
                {{ formatCount(status.bot.memberCount) }} members
              </template>
              <template v-if="status.bot.memberCount != null && status.bot.channelCount != null">
                ·
              </template>
              <template v-if="status.bot.channelCount != null">
                {{ formatCount(status.bot.channelCount) }} channels
              </template>
            </v-list-item-subtitle>
            <v-list-item-subtitle v-if="status.bot.wsPingMs != null" class="mt-1">
              Gateway ping {{ status.bot.wsPingMs }}ms
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

    <v-alert
      v-if="statsError"
      type="error"
      variant="tonal"
      class="mb-6"
      :text="statsError"
    />

    <v-skeleton-loader v-if="statsLoading" type="card@5" class="mb-6" />

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

      <v-col cols="12" sm="6" md="4">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="primary">mdi-clock-outline</v-icon>
            Reminders
          </v-card-title>
          <v-card-text class="pa-0 statistics-metrics">
            <p>
              Pending: {{ formatCount(statistics.scheduledMessages.pending) }}
            </p>
            <p>Sent: {{ formatCount(statistics.scheduledMessages.sent) }}</p>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="4">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="secondary">mdi-function-variant</v-icon>
            Trigger Response Functions
          </v-card-title>
          <v-card-text class="pa-0 statistics-metrics">
            <p
              v-if="!responseFunctions.length"
              class="text-caption text-medium-emphasis"
            >
              No trigger response functions in the catalog.
            </p>
            <p v-for="fn in responseFunctions" :key="fn.id">
              {{ fn.display_name || fn.function_name }}:
              {{ formatCount(fn.frequency) }}
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <p
      v-if="!statsLoading && updatedAt"
      class="text-caption text-medium-emphasis text-center mt-6"
    >
      Updated {{ updatedAt }}
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { fetchSystemStatus } from "../lib/systemStatus.js";
import { fetchStatistics } from "../lib/statistics.js";
import { fetchTriggerResponseFunctions } from "../lib/triggerResponseFunctions.js";

const statusLoading = ref(true);
const statusError = ref("");
/** @type {import("vue").Ref<{
 *   webapi: string,
 *   db: string,
 *   dbType: string,
 *   cacheVersion: string,
 *   webapiUptimeSeconds: number,
 *   webapiMemoryRssBytes: number,
 *   bot: {
 *     guildId: string,
 *     version: string,
 *     lastSeenAt: string,
 *     online: boolean,
 *     readyAt: string | null,
 *     uptimeSeconds: number | null,
 *     memberCount: number | null,
 *     channelCount: number | null,
 *     wsPingMs: number | null,
 *   } | null,
 * } | null>} */
const status = ref(null);

const statsLoading = ref(true);
const statsError = ref("");
/** @type {import("vue").Ref<{
 *   chatMemberMappings: number,
 *   emojiCatalog: { emojis: number, stickers: number, total: number },
 *   emojiUsage: { emojis: number, stickers: number, total: number },
 *   pinHistory: number,
 *   plusplusTracking: number,
 *   triggers: number,
 *   responses: number,
 *   triggerResponseFrequencySum: number,
 *   repostTracking: number,
 *   scheduledMessages: { pending: number, sent: number }
 * } | null>} */
const statistics = ref(null);
/** @type {import("vue").Ref<Array<{ id: number, function_name: string, frequency: number, display_name: string|null }>>} */
const responseFunctions = ref([]);
const updatedAt = ref("");

/**
 * @param {string} value
 * @returns {string} Vuetify color token.
 */
function statusColor(value) {
  return value === "ok" ? "success" : "error";
}

/**
 * @param {string} value
 * @returns {string}
 */
function formatStatus(value) {
  return value === "ok" ? "Operational" : "Error";
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatTimestamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/**
 * @param {number} totalSeconds
 * @returns {string} Compact "Xh Ym" / "Xd Yh" duration.
 */
function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * @param {number} bytes
 * @returns {string} Human-readable size (e.g. "128.4 MB").
 */
function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let value = n / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * @param {number} value
 * @returns {string}
 */
function formatCount(value) {
  return Number(value).toLocaleString();
}

/**
 * @returns {Promise<void>}
 */
async function loadStatus() {
  statusLoading.value = true;
  statusError.value = "";

  try {
    status.value = await fetchSystemStatus();
  } catch (err) {
    statusError.value =
      err instanceof Error ? err.message : "Failed to load system status";
  } finally {
    statusLoading.value = false;
  }
}

/**
 * @returns {Promise<void>}
 */
async function loadStatistics() {
  statsLoading.value = true;
  statsError.value = "";

  try {
    statistics.value = await fetchStatistics();
    updatedAt.value = new Date().toLocaleString();
  } catch (err) {
    statsError.value =
      err instanceof Error ? err.message : "Failed to load statistics";
  } finally {
    statsLoading.value = false;
  }

  try {
    responseFunctions.value = await fetchTriggerResponseFunctions();
  } catch (err) {
    console.warn("Failed to load trigger response functions:", err);
  }
}

onMounted(() => {
  void loadStatus();
  void loadStatistics();
});
</script>

<style scoped>
.statistics-metrics p {
  margin: 0 0 0.35rem;
}
</style>
