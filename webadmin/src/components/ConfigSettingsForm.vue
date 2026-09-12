<template>
  <div>
    <v-card class="glass-card pa-6 mb-6">
      <v-card-title class="text-h6 pa-0 mb-4">Feature Flags</v-card-title>
      <v-card-text class="pa-0">
        <v-switch
          v-for="entry in flagEntries"
          :key="entry.config"
          :model-value="draft[entry.config] === 'true'"
          :label="entry.config"
          :hint="entry.description || undefined"
          persistent-hint
          color="primary"
          density="comfortable"
          :loading="savingKey === entry.config"
          :disabled="savingKey === entry.config"
          @update:model-value="(val) => saveFlag(entry, val)"
        />
      </v-card-text>
    </v-card>

    <v-card class="glass-card pa-6">
      <v-card-title class="text-h6 pa-0 mb-4">Settings</v-card-title>
      <v-card-text class="pa-0">
        <div
          v-for="entry in settingEntries"
          :key="entry.config"
          class="setting-row mb-6"
        >
          <div class="d-flex align-center ga-2 mb-1 flex-wrap">
            <span class="text-body-2 font-weight-medium">{{ entry.config }}</span>
            <v-chip v-if="entry.requiresBotRestart" size="x-small" color="warning" variant="tonal">
              restart required
            </v-chip>
          </div>
          <p v-if="entry.description" class="text-caption text-medium-emphasis mb-2">
            {{ entry.description }}
          </p>

          <v-combobox
            v-if="isRolePicker(entry.config)"
            v-model="draft[entry.config]"
            :items="roleItems"
            item-title="title"
            item-value="value"
            multiple
            chips
            closable-chips
            density="comfortable"
            variant="outlined"
            hide-details
            :placeholder="roleItems.length ? undefined : 'No synced roles — enter role IDs'"
          />
          <v-combobox
            v-else-if="isChannelPicker(entry.config)"
            v-model="draft[entry.config]"
            :items="channelItems"
            item-title="title"
            item-value="value"
            density="comfortable"
            variant="outlined"
            hide-details
            :placeholder="channelItems.length ? undefined : 'No synced channels — enter a channel ID'"
          />
          <v-text-field
            v-else
            v-model="draft[entry.config]"
            :type="entry.type === 'integer' ? 'number' : 'text'"
            density="comfortable"
            variant="outlined"
            hide-details
          />

          <div class="d-flex justify-end mt-2">
            <v-btn
              size="small"
              color="primary"
              variant="tonal"
              :disabled="!isDirty(entry)"
              :loading="savingKey === entry.config"
              @click="saveSetting(entry)"
            >
              Save
            </v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import { updateConfigValue } from "../lib/config.js";
import { useSnackbar } from "../composables/useSnackbar.js";

const props = defineProps({
  entries: { type: Array, required: true },
  channels: { type: Array, default: () => [] },
  roles: { type: Array, default: () => [] },
});

const { notify } = useSnackbar();

const ROLE_LIST_KEYS = new Set(["pin_message_role_ids"]);
const CHANNEL_KEYS = new Set([
  "pin_channel_id",
  "announce_channel_id",
  "user_mapping_import_channel_id",
]);

/** @type {Record<string, string|string[]>} Editable form state, keyed by config name. */
const draft = reactive({});
/** Last-saved raw value per key (as stored by webapi), for dirty-checking. */
const savedValues = reactive({});
const savingKey = ref(null);

let seeded = false;
watch(
  () => props.entries,
  (entries) => {
    if (seeded || !entries?.length) return;
    seeded = true;
    for (const entry of entries) {
      savedValues[entry.config] = entry.value;
      draft[entry.config] = ROLE_LIST_KEYS.has(entry.config)
        ? safeParseIdArray(entry.value)
        : entry.value;
    }
  },
  { immediate: true },
);

const flagEntries = computed(() =>
  props.entries.filter((entry) => entry.type === "boolean"),
);
const settingEntries = computed(() =>
  props.entries.filter((entry) => entry.type !== "boolean"),
);

const channelItems = computed(() =>
  props.channels.map((channel) => ({
    title: `#${channel.name} (${channel.id})`,
    value: channel.id,
  })),
);
const roleItems = computed(() =>
  props.roles.map((role) => ({ title: role.name, value: role.id })),
);

/**
 * @param {string} value JSON-array-of-ids string, e.g. `'["1","2"]'`.
 * @returns {string[]}
 */
function safeParseIdArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * @param {string} config
 * @returns {boolean}
 */
function isRolePicker(config) {
  return ROLE_LIST_KEYS.has(config);
}

/**
 * @param {string} config
 * @returns {boolean}
 */
function isChannelPicker(config) {
  return CHANNEL_KEYS.has(config);
}

/**
 * @param {{ config: string }} entry
 * @returns {boolean}
 */
function isDirty(entry) {
  return serializeDraft(entry.config) !== savedValues[entry.config];
}

/**
 * @param {string} config
 * @returns {string}
 */
function serializeDraft(config) {
  return ROLE_LIST_KEYS.has(config)
    ? JSON.stringify(draft[config] ?? [])
    : String(draft[config] ?? "");
}

/**
 * @param {{ config: string }} entry
 * @returns {Promise<void>}
 */
async function saveSetting(entry) {
  const value = serializeDraft(entry.config);
  savingKey.value = entry.config;
  try {
    await updateConfigValue(entry.config, value);
    savedValues[entry.config] = value;
    notify(`Saved ${entry.config}`);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to save config", {
      color: "error",
    });
  } finally {
    savingKey.value = null;
  }
}

/**
 * @param {{ config: string }} entry
 * @param {boolean} enabled
 * @returns {Promise<void>}
 */
async function saveFlag(entry, enabled) {
  const value = String(enabled);
  savingKey.value = entry.config;
  try {
    await updateConfigValue(entry.config, value);
    draft[entry.config] = value;
    savedValues[entry.config] = value;
    notify(`Saved ${entry.config}`);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to save config", {
      color: "error",
    });
  } finally {
    savingKey.value = null;
  }
}
</script>

<style scoped>
.setting-row:last-child {
  margin-bottom: 0 !important;
}
</style>
