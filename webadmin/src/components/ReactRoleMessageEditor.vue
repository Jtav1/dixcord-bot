<template>
  <v-dialog v-model="internalOpen" max-width="960" scrollable persistent>
    <v-card class="glass-card">
      <v-card-title class="text-h6 pa-6 pb-2">
        {{ message ? "Edit Post" : "New Post" }}
      </v-card-title>

      <v-card-text class="pa-6 pt-2">
        <v-alert
          v-if="message?.lastSyncError && message.lastSyncErrorVersion === message.contentVersion"
          type="error"
          variant="tonal"
          class="mb-4"
          :text="`The bot could not update the live message: ${message.lastSyncError}`"
        />

        <div class="text-subtitle-1 font-weight-medium mb-3">Message</div>
        <v-combobox
          v-model="form.channelId"
          :items="channelItems"
          item-title="title"
          item-value="value"
          :return-object="false"
          label="Channel"
          density="comfortable"
          variant="outlined"
          class="mb-4"
          :placeholder="channelItems.length ? undefined : 'No synced channels — enter a channel ID'"
        />
        <v-text-field
          v-model="form.title"
          label="Title"
          density="comfortable"
          variant="outlined"
          class="mb-4"
        />
        <v-textarea
          v-model="form.description"
          label="Description (optional)"
          rows="2"
          auto-grow
          density="comfortable"
          variant="outlined"
          class="mb-6"
        />

        <div class="text-subtitle-1 font-weight-medium mb-3 d-flex align-center justify-space-between">
          <span>Roles</span>
          <span class="text-caption text-medium-emphasis">{{ form.bindings.length }} / {{ maxBindings }}</span>
        </div>
        <div v-for="(row, index) in form.bindings" :key="row._key" class="binding-row mb-4">
          <v-combobox
            v-model="row.emoji"
            :items="emojiItems"
            item-title="emoji"
            item-value="emoid"
            :return-object="false"
            label="Emoji"
            density="comfortable"
            variant="outlined"
            hide-details
            class="binding-emoji"
            :placeholder="emojiItems.length ? undefined : 'Type an emoji, or paste a custom emoji ID'"
          >
            <template #item="{ item, props: itemProps }">
              <v-list-item v-bind="itemProps" :title="undefined">
                <template #title>{{ emojiLabel(item) }}</template>
              </v-list-item>
            </template>
          </v-combobox>
          <v-combobox
            v-model="row.roleId"
            :items="roleItems"
            item-title="name"
            item-value="id"
            :return-object="false"
            label="Role"
            density="comfortable"
            variant="outlined"
            hide-details
            class="binding-role"
            :placeholder="roleItems.length ? undefined : 'No synced roles — enter a role ID'"
          >
            <template #item="{ item, props: itemProps }">
              <v-list-item v-bind="itemProps">
                <template #title>
                  <span :style="roleChipStyle(item)">{{ roleLabel(item) }}</span>
                </template>
              </v-list-item>
            </template>
          </v-combobox>
          <v-text-field
            v-model="row.description"
            label="Description"
            density="comfortable"
            variant="outlined"
            hide-details
            class="binding-description"
          />
          <v-btn
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            @click="removeRow(index)"
          />
        </div>

        <v-btn
          size="small"
          variant="tonal"
          prepend-icon="mdi-plus"
          :disabled="form.bindings.length >= maxBindings"
          @click="addRow"
        >
          Add Row
        </v-btn>

        <v-alert v-if="validationError" type="error" variant="tonal" class="mt-6" :text="validationError" />
      </v-card-text>

      <v-card-actions class="pa-6 pt-2">
        <v-spacer />
        <span v-if="savingStatus" class="text-caption text-medium-emphasis mr-2">{{ savingStatus }}</span>
        <v-btn variant="text" :disabled="saving" @click="internalOpen = false">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="saving"
          :disabled="Boolean(validationError)"
          @click="onSave"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from "vue";
import {
  createReactRoleMessage,
  updateReactRoleMessage,
  waitForReactRoleSync,
} from "../lib/reactRole.js";
import { useSnackbar } from "../composables/useSnackbar.js";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  app: { type: String, required: true },
  guildId: { type: String, required: true },
  /** The message being edited, or null to create a new one. */
  message: { type: Object, default: null },
  channels: { type: Array, default: () => [] },
  roles: { type: Array, default: () => [] },
  emojis: { type: Array, default: () => [] },
});

/** `saved` fires after the save (and the bot's sync attempt) finished, so the parent can reload. */
const emit = defineEmits(["update:modelValue", "saved"]);

const { notify } = useSnackbar();

const maxBindings = 20;
let nextRowKey = 0;

const saving = ref(false);
const savingStatus = ref("");

const form = reactive({
  channelId: "",
  title: "",
  description: "",
  bindings: [],
});

const internalOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

/**
 * @returns {{_key:number, emoji:string, roleId:string, description:string}}
 */
function blankRow() {
  return { _key: nextRowKey++, emoji: "", roleId: "", description: "" };
}

/** @returns {void} */
function addRow() {
  form.bindings.push(blankRow());
}

/**
 * @param {number} index
 * @returns {void}
 */
function removeRow(index) {
  form.bindings.splice(index, 1);
}

const channelItems = computed(() =>
  props.channels.map((channel) => ({ title: `#${channel.name} (${channel.id})`, value: channel.id })),
);
const roleItems = computed(() => props.roles);
const emojiItems = computed(() =>
  [...props.emojis].sort((a, b) => (a.emoji ?? "").localeCompare(b.emoji ?? "")),
);

/**
 * @param {object|string} item
 * @returns {string}
 */
function emojiLabel(item) {
  return typeof item === "string" ? item : (item?.emoji ?? "");
}

/**
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
 * Client-side mirror of the webapi's authoritative validation, for early feedback.
 * @returns {string|null}
 */
const validationError = computed(() => {
  if (!form.channelId?.toString().trim()) return "A channel is required.";
  if (!form.title?.trim()) return "A title is required.";
  if (form.bindings.length === 0) return "At least one role row is required.";
  if (form.bindings.length > maxBindings) return `No more than ${maxBindings} rows are allowed.`;

  const seenEmoji = new Set();
  const seenRole = new Set();
  for (const row of form.bindings) {
    const emoji = String(row.emoji ?? "").trim();
    const roleId = String(row.roleId ?? "").trim();
    const description = String(row.description ?? "").trim();
    if (!emoji || !roleId || !description) {
      return "Every row needs an emoji, a role, and a description.";
    }
    if (seenEmoji.has(emoji)) return `Duplicate emoji in binding list: ${emoji}`;
    seenEmoji.add(emoji);
    if (seenRole.has(roleId)) return `Duplicate role in binding list: ${roleId}`;
    seenRole.add(roleId);
  }
  return null;
});

/**
 * Populate form state from the message being edited (blank for a new one).
 * @param {object|null} loaded
 * @returns {void}
 */
function applyMessage(loaded) {
  if (!loaded) {
    form.channelId = "";
    form.title = "";
    form.description = "";
    form.bindings = [blankRow()];
    return;
  }
  form.channelId = loaded.channelId;
  form.title = loaded.title;
  form.description = loaded.description ?? "";
  form.bindings = loaded.bindings.map((b) => ({
    _key: nextRowKey++,
    emoji: b.emoji,
    roleId: b.roleId,
    description: b.description,
  }));
}

// Reset the form each time the dialog opens, so a cancelled edit never leaks into the next one.
watch(
  () => props.modelValue,
  (open) => {
    if (open) applyMessage(props.message);
  },
  { immediate: true },
);

/**
 * Save, then wait for the bot's near-immediate reconciliation to post/edit the live message, so
 * a failure (bad permissions, deleted channel, etc.) is surfaced here rather than silently
 * retried forever.
 * @returns {Promise<void>}
 */
async function onSave() {
  saving.value = true;
  savingStatus.value = "Saving...";
  try {
    const fields = {
      channelId: String(form.channelId).trim(),
      title: form.title.trim(),
      description: form.description?.trim() || undefined,
      bindings: form.bindings.map((row, index) => ({
        emoji: String(row.emoji).trim(),
        roleId: String(row.roleId).trim(),
        description: row.description.trim(),
        sortOrder: index,
      })),
    };
    const saved = props.message
      ? await updateReactRoleMessage(props.app, props.guildId, props.message.id, fields)
      : await createReactRoleMessage(props.app, props.guildId, fields);

    savingStatus.value = "Posting to the live channel...";
    const result = await waitForReactRoleSync(props.app, props.guildId, saved.id, saved.contentVersion);

    if (result.status === "synced") {
      notify("Saved — the live message has been updated");
    } else if (result.status === "failed") {
      notify(`Save failed: the bot could not update the live message — ${result.error}`, {
        color: "error",
      });
    } else {
      notify("Saved, but still waiting on the bot to update the live message — check back shortly", {
        color: "warning",
      });
    }
    // Always close: for a new post the row now exists, so saving again here would duplicate it.
    // A failed sync stays visible on the post's card in the list.
    emit("saved");
    internalOpen.value = false;
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to save react-for-role message", {
      color: "error",
    });
  } finally {
    saving.value = false;
    savingStatus.value = "";
  }
}
</script>

<style scoped>
.binding-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.binding-emoji {
  flex: 1 1 160px;
}

.binding-role {
  flex: 1 1 200px;
}

.binding-description {
  flex: 2 1 280px;
}
</style>
