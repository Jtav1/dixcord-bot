<template>
  <div class="view-page">
    <header class="view-header mb-6 d-flex align-center justify-space-between flex-wrap ga-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-2">React For Role</h1>
        <p class="text-body-1 text-medium-emphasis">
          Post a message members can react to for self-assignable roles
        </p>
      </div>
    </header>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-6" :text="error" />
    <v-alert
      v-if="message?.pendingDelete"
      type="warning"
      variant="tonal"
      class="mb-6"
      text="Deletion requested — the bot will remove the live message shortly."
    />

    <v-skeleton-loader v-if="loading" type="card@2" class="mb-6" />

    <template v-else>
      <v-card class="glass-card pa-6 mb-6">
        <v-card-title class="text-h6 pa-0 mb-4">Message</v-card-title>
        <v-card-text class="pa-0">
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
          />
        </v-card-text>
      </v-card>

      <v-card class="glass-card pa-6 mb-6">
        <v-card-title class="text-h6 pa-0 mb-4 d-flex align-center justify-space-between">
          <span>Roles</span>
          <span class="text-caption text-medium-emphasis">{{ form.bindings.length }} / {{ maxBindings }}</span>
        </v-card-title>
        <v-card-text class="pa-0">
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
        </v-card-text>
      </v-card>

      <v-alert v-if="validationError" type="error" variant="tonal" class="mb-6" :text="validationError" />

      <div class="d-flex align-center justify-space-between flex-wrap ga-4">
        <v-btn
          v-if="message"
          color="error"
          variant="tonal"
          prepend-icon="mdi-delete"
          :disabled="message.pendingDelete"
          @click="openDeleteStep1"
        >
          Delete
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          variant="flat"
          :loading="saving"
          :disabled="Boolean(validationError)"
          @click="onSave"
        >
          Save
        </v-btn>
      </div>
    </template>

    <ConfirmDialog
      v-model="deleteStep1Open"
      title="Delete React-For-Role Message"
      message="This will remove the live message and all role bindings. Continue?"
      confirm-label="Continue"
      @confirm="openDeleteStep2"
      @cancel="deleteStep1Open = false"
    />
    <ConfirmDialog
      v-model="deleteStep2Open"
      title="Are you sure?"
      message="This cannot be undone. The bot will remove the live message shortly after you confirm."
      confirm-label="Yes, delete it"
      :loading="deleting"
      @confirm="onDelete"
      @cancel="deleteStep2Open = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import { fetchGuildSnapshot } from "../lib/guild.js";
import { fetchReactRoleMessage, saveReactRoleMessage, deleteReactRoleMessage } from "../lib/reactRole.js";
import { appForClientKey } from "../nav/clients.js";
import { useSnackbar } from "../composables/useSnackbar.js";

const route = useRoute();
const router = useRouter();
const { notify } = useSnackbar();

const maxBindings = 20;
let nextRowKey = 0;

const loading = ref(true);
const error = ref("");
const saving = ref(false);
const deleting = ref(false);
const deleteStep1Open = ref(false);
const deleteStep2Open = ref(false);

/** @type {import("vue").Ref<string|null>} */
const currentApp = ref(null);
/** @type {import("vue").Ref<string|null>} */
const currentGuildId = ref(null);
/** @type {import("vue").Ref<Array<{id:string,name:string}>>} */
const channels = ref([]);
/** @type {import("vue").Ref<Array<{id:string,name:string,color:string|null}>>} */
const roles = ref([]);
/** @type {import("vue").Ref<Array<{emoid:string,app:string,emoji:string}>>} */
const emojis = ref([]);
/** @type {import("vue").Ref<object|null>} */
const message = ref(null);

const form = reactive({
  channelId: "",
  title: "",
  description: "",
  bindings: [],
});

/**
 * @returns {{id:string, _key:number, emoji:string, roleId:string, description:string}}
 */
function blankRow() {
  return { _key: nextRowKey++, emoji: "", roleId: "", description: "" };
}

/**
 * @returns {void}
 */
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
  channels.value.map((channel) => ({ title: `#${channel.name} (${channel.id})`, value: channel.id })),
);
const roleItems = computed(() => roles.value);
const emojiItems = computed(() =>
  [...emojis.value].sort((a, b) => (a.emoji ?? "").localeCompare(b.emoji ?? "")),
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
 * Populate form state from a loaded (or absent) message.
 * @param {object|null} loaded
 * @returns {void}
 */
function applyMessage(loaded) {
  message.value = loaded;
  if (!loaded) {
    form.channelId = "";
    form.title = "";
    form.description = "";
    form.bindings = [];
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

/**
 * React-for-role is guild-scoped — resolve app from the active client (discord-bot/fluxer-bot)
 * and guildId from the active guild tab, never guessed.
 * @returns {Promise<void>}
 */
async function load() {
  const guildScope = route.params.guildScope;
  if (guildScope === "global") {
    const [, clientKey] = route.path.split("/");
    router.replace(`/${clientKey}/global/dashboard`);
    return;
  }
  const [, clientKey] = route.path.split("/");
  const app = appForClientKey(clientKey);

  loading.value = true;
  error.value = "";
  try {
    const snapshot = await fetchGuildSnapshot(app, guildScope);
    currentApp.value = snapshot.guild.app;
    currentGuildId.value = snapshot.guild.guildId;
    channels.value = snapshot.channels;
    roles.value = snapshot.roles;
    emojis.value = snapshot.emojis;
    applyMessage(await fetchReactRoleMessage(currentApp.value, currentGuildId.value));
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load react-for-role message";
  } finally {
    loading.value = false;
  }
}

/**
 * @returns {Promise<void>}
 */
async function onSave() {
  saving.value = true;
  try {
    const saved = await saveReactRoleMessage(currentApp.value, currentGuildId.value, {
      channelId: String(form.channelId).trim(),
      title: form.title.trim(),
      description: form.description?.trim() || undefined,
      bindings: form.bindings.map((row, index) => ({
        emoji: String(row.emoji).trim(),
        roleId: String(row.roleId).trim(),
        description: row.description.trim(),
        sortOrder: index,
      })),
    });
    applyMessage(saved);
    notify("Saved — the bot will update the live message shortly");
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to save react-for-role message", {
      color: "error",
    });
  } finally {
    saving.value = false;
  }
}

/** @returns {void} */
function openDeleteStep1() {
  deleteStep1Open.value = true;
}

/** @returns {void} */
function openDeleteStep2() {
  deleteStep1Open.value = false;
  deleteStep2Open.value = true;
}

/**
 * @returns {Promise<void>}
 */
async function onDelete() {
  deleting.value = true;
  try {
    await deleteReactRoleMessage(currentApp.value, currentGuildId.value);
    notify("Delete requested — the bot will remove the live message shortly");
    deleteStep2Open.value = false;
    await load();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to delete react-for-role message", {
      color: "error",
    });
  } finally {
    deleting.value = false;
  }
}

watch(() => route.params.guildScope, () => {
  void load();
});

onMounted(() => {
  void load();
});
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
