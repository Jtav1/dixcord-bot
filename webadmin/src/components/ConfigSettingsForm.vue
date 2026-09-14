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
            item-title="name"
            item-value="id"
            :return-object="false"
            multiple
            chips
            closable-chips
            density="comfortable"
            variant="outlined"
            hide-details
            :placeholder="roleItems.length ? undefined : 'No synced roles — enter role IDs'"
          >
            <template #chip="{ item, props: chipProps }">
              <v-chip v-bind="chipProps" variant="outlined" :text="roleLabel(item)" :style="roleChipStyle(item)" />
            </template>
            <template #item="{ item, props: itemProps }">
              <v-list-item v-bind="itemProps">
                <template #title>
                  <span :style="roleChipStyle(item)">{{ roleLabel(item) }}</span>
                </template>
              </v-list-item>
            </template>
          </v-combobox>
          <v-combobox
            v-else-if="isChannelPicker(entry.config)"
            v-model="draft[entry.config]"
            :items="channelItems"
            item-title="title"
            item-value="value"
            :return-object="false"
            density="comfortable"
            variant="outlined"
            hide-details
            :placeholder="channelItems.length ? undefined : 'No synced channels — enter a channel ID'"
          />
          <v-combobox
            v-else-if="isEmojiPicker(entry.config)"
            v-model="draft[entry.config]"
            :items="emojiItems"
            item-title="emoji"
            item-value="emoid"
            :return-object="false"
            density="comfortable"
            variant="outlined"
            hide-details
            :placeholder="emojiItems.length ? undefined : 'No synced emojis — type an emoji, or paste a custom emoji ID'"
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
  app: { type: String, required: true },
  guildId: { type: String, required: true },
  entries: { type: Array, required: true },
  channels: { type: Array, default: () => [] },
  roles: { type: Array, default: () => [] },
  emojis: { type: Array, default: () => [] },
});

const { notify } = useSnackbar();

const ROLE_LIST_KEYS = new Set(["pin_message_role_ids"]);
const CHANNEL_KEYS = new Set([
  "pin_channel_id",
  "announce_channel_id",
  "user_mapping_import_channel_id",
]);
const EMOJI_KEYS = new Set([
  "pin_emoji",
  "plusplus_emoji",
  "minusminus_emoji",
  "repost_emoji",
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
      if (ROLE_LIST_KEYS.has(entry.config)) {
        savedValues[entry.config] = entry.value;
        draft[entry.config] = safeParseIdArray(entry.value);
      } else if (EMOJI_KEYS.has(entry.config)) {
        const raw = emojiValueToString(entry.value);
        savedValues[entry.config] = raw;
        draft[entry.config] = raw;
      } else {
        savedValues[entry.config] = entry.value;
        draft[entry.config] = entry.value;
      }
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
/** Role objects as returned by GET /api/guild ({id,name,color,position,mentionable,hoisted}). */
const roleItems = computed(() => props.roles);
/** Emoji objects as returned by GET /api/guild ({emoid,app,emoji,frequency,animated,type}), scoped to this app and excluding stickers, sorted alphabetically by display name. */
const emojiItems = computed(() =>
  [...props.emojis].sort((a, b) => (a.emoji ?? "").localeCompare(b.emoji ?? "")),
);

/**
 * Reconstruct the raw guild_config.value string from a resolved ConfigEmojiValue object (see
 * webapi's resolveConfigEmojiValue): emoid if it matched a synced emoji_frequency row, else the
 * freeform `emoji` text that was typed by hand. Used both to seed the combobox's plain-string
 * v-model and to compare against the saved value for dirty-checking.
 * @param {{emoid:string|null,emoji:string|null}|null} value
 * @returns {string}
 */
function emojiValueToString(value) {
  if (value == null) return "";
  return String(value.emoid ?? value.emoji ?? "");
}

/**
 * VCombobox items are either a matched role object (`return-object="false"` is required for
 * this — without it, Vuetify's own item-matching skips the lookup whenever the model value is a
 * string, so a role never resolves to its item), or (freeSolo, when nothing is synced) a bare
 * string the admin typed directly — handle both.
 * @param {object|string} item
 * @returns {string}
 */
function roleLabel(item) {
  return typeof item === "string" ? item : (item?.name ?? "");
}

/**
 * @param {object|string} item
 * @returns {Record<string, string>}
 */
function roleChipStyle(item) {
  const color = typeof item === "string" ? null : item?.color;
  return color ? { color, borderColor: color } : {};
}

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
 * @param {string} config
 * @returns {boolean}
 */
function isEmojiPicker(config) {
  return EMOJI_KEYS.has(config);
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
    await updateConfigValue(props.app, props.guildId, entry.config, value);
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
    await updateConfigValue(props.app, props.guildId, entry.config, value);
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
