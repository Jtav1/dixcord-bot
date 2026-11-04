<template>
  <div class="view-page">
    <header class="view-header mb-6 d-flex align-center justify-space-between flex-wrap ga-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-2">React For Role</h1>
        <p class="text-body-1 text-medium-emphasis">
          Post messages members can react to for self-assignable roles
        </p>
      </div>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-plus"
        :disabled="loading || messages.length >= MAX_REACT_ROLE_MESSAGES"
        @click="openEditor(null)"
      >
        New Post
      </v-btn>
    </header>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-6" :text="error" />

    <v-skeleton-loader v-if="loading" type="card@2" class="mb-6" />

    <template v-else>
      <p v-if="messages.length === 0 && !error" class="text-body-1 text-medium-emphasis">
        No posts yet. Create one to get started.
      </p>

      <v-card v-for="item in messages" :key="item.id" class="glass-card pa-6 mb-4">
        <div class="d-flex align-start justify-space-between flex-wrap ga-4">
          <div>
            <div class="text-h6">{{ item.title }}</div>
            <div class="text-body-2 text-medium-emphasis">
              {{ channelName(item.channelId) }} · {{ item.bindings.length }}
              {{ item.bindings.length === 1 ? "role" : "roles" }}
            </div>
          </div>
          <div class="d-flex align-center ga-2">
            <v-chip :color="statusOf(item).color" size="small" variant="tonal">
              {{ statusOf(item).label }}
            </v-chip>
            <v-btn
              size="small"
              variant="tonal"
              prepend-icon="mdi-pencil"
              :disabled="item.pendingDelete"
              @click="openEditor(item)"
            >
              Edit
            </v-btn>
            <v-btn
              size="small"
              variant="tonal"
              color="error"
              prepend-icon="mdi-delete"
              :disabled="item.pendingDelete"
              @click="openDeleteStep1(item)"
            >
              Delete
            </v-btn>
          </div>
        </div>
        <v-alert
          v-if="item.pendingDelete"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-4"
          text="Deletion requested — the bot will remove the live message shortly."
        />
        <v-alert
          v-else-if="item.lastSyncError && item.lastSyncErrorVersion === item.contentVersion"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-4"
          :text="`The bot could not update the live message: ${item.lastSyncError}`"
        />
      </v-card>
    </template>

    <ReactRoleMessageEditor
      v-model="editorOpen"
      :app="currentApp ?? ''"
      :guild-id="currentGuildId ?? ''"
      :message="editing"
      :channels="channels"
      :roles="roles"
      :emojis="emojis"
      @saved="load"
    />

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
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import ReactRoleMessageEditor from "../components/ReactRoleMessageEditor.vue";
import { fetchGuildSnapshot } from "../lib/guild.js";
import {
  MAX_REACT_ROLE_MESSAGES,
  fetchReactRoleMessages,
  deleteReactRoleMessage,
} from "../lib/reactRole.js";
import { useSnackbar } from "../composables/useSnackbar.js";

const route = useRoute();
const { notify } = useSnackbar();

const loading = ref(true);
const error = ref("");
const deleting = ref(false);
const deleteStep1Open = ref(false);
const deleteStep2Open = ref(false);
const editorOpen = ref(false);

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
/** @type {import("vue").Ref<object[]>} */
const messages = ref([]);
/** @type {import("vue").Ref<object|null>} Post open in the editor (null = creating a new one). */
const editing = ref(null);
/** @type {import("vue").Ref<object|null>} Post awaiting delete confirmation. */
const deleteTarget = ref(null);

/**
 * @param {string} channelId
 * @returns {string}
 */
function channelName(channelId) {
  const channel = channels.value.find((c) => c.id === channelId);
  return channel ? `#${channel.name}` : `Channel ${channelId}`;
}

/**
 * @param {object} item
 * @returns {{label:string, color:string}}
 */
function statusOf(item) {
  if (item.pendingDelete) return { label: "Deleting", color: "warning" };
  if (item.lastSyncError && item.lastSyncErrorVersion === item.contentVersion) {
    return { label: "Sync failed", color: "error" };
  }
  if (item.syncedVersion === item.contentVersion) return { label: "Live", color: "success" };
  return { label: "Pending sync", color: "warning" };
}

/**
 * @param {object|null} item Post to edit, or null to create one.
 * @returns {void}
 */
function openEditor(item) {
  editing.value = item;
  editorOpen.value = true;
}

/**
 * Reload the list. Channels/roles/emojis come from the guild snapshot, loaded once.
 * React-for-role is per-(app, guildId) — both come straight from the route params (set by
 * AppShell's bot picker), never guessed.
 * @returns {Promise<void>}
 */
async function load() {
  error.value = "";
  try {
    if (currentApp.value === null) {
      const snapshot = await fetchGuildSnapshot(route.params.app, route.params.guildId);
      currentApp.value = snapshot.guild.app;
      currentGuildId.value = snapshot.guild.guildId;
      channels.value = snapshot.channels;
      roles.value = snapshot.roles;
      emojis.value = snapshot.emojis;
    }
    messages.value = await fetchReactRoleMessages(currentApp.value, currentGuildId.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load react-for-role messages";
  } finally {
    loading.value = false;
  }
}

/**
 * @param {object} item
 * @returns {void}
 */
function openDeleteStep1(item) {
  deleteTarget.value = item;
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
    await deleteReactRoleMessage(currentApp.value, currentGuildId.value, deleteTarget.value.id);
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

onMounted(() => {
  void load();
});
</script>
