<template>
  <div class="view-page view-page--wide">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Pin Archive</h1>
      <p class="text-body-1 text-medium-emphasis">
        Archived pinned messages, with metadata correction
      </p>
    </header>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-6" :text="error" />
    <v-skeleton-loader v-if="loading" type="article@3" />

    <template v-else>
      <v-card v-for="entry in items" :key="entry.id" class="glass-card pa-6 mb-4">
        <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-2">
          <span class="text-body-1">
            <span class="font-weight-bold">{{ nameFor(entry.author) }}</span>
            <span class="text-medium-emphasis ml-2">#{{ entry.channelName || entry.channelId || "?" }}</span>
          </span>
          <div class="d-flex align-center ga-2">
            <span class="text-caption text-medium-emphasis">{{ formatTimestamp(entry.timestamp) }}</span>
            <v-chip size="small" :color="entry.hydrated ? 'success' : 'warning'" variant="tonal">
              {{ entry.hydrated ? "hydrated" : "pending" }}
            </v-chip>
            <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(entry)" />
          </div>
        </div>

        <p v-if="entry.contents" class="text-body-2 mb-2" style="white-space: pre-wrap">
          {{ entry.contents }}
        </p>
        <p v-if="entry.attachments?.length" class="text-caption text-medium-emphasis mb-2">
          Attachments: {{ entry.attachments.join(", ") }}
        </p>
        <p class="text-caption text-medium-emphasis mb-0">
          Pinned by: {{ entry.pinners?.map(nameFor).join(", ") || "—" }}
        </p>
      </v-card>

      <p v-if="!items.length" class="text-medium-emphasis text-center py-8">No pinned messages recorded yet.</p>

      <div v-if="totalPages > 1" class="d-flex justify-center mt-4">
        <v-pagination
          :model-value="page"
          :length="totalPages"
          density="compact"
          total-visible="7"
          @update:model-value="load"
        />
      </div>
    </template>

    <v-dialog v-model="dialogOpen" max-width="520">
      <v-card class="glass-card">
        <v-card-title class="text-h6">Edit Pin</v-card-title>
        <v-card-text>
          <v-textarea v-model="form.contents" label="Contents" rows="3" auto-grow class="mb-3" />
          <v-text-field v-model="form.channelName" label="Channel name" class="mb-3" />
          <v-text-field v-model="form.channelId" label="Channel ID" class="mb-3" />
          <v-switch v-model="form.hydrated" label="Hydrated" color="primary" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="onSave">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { usePaginatedResource } from "../composables/usePaginatedResource.js";
import { useSnackbar } from "../composables/useSnackbar.js";
import { fetchPinHistory, updatePinHistoryEntry } from "../lib/pinHistory.js";
import { fetchUserMappings } from "../lib/userMappings.js";

const { notify } = useSnackbar();

const { items, loading, error, page, totalPages, load } = usePaginatedResource(fetchPinHistory);

/** @type {import("vue").Ref<Map<number,string>>} */
const nameMap = ref(new Map());

/**
 * @param {number|null} id chat_member_mapping id
 * @returns {string}
 */
function nameFor(id) {
  if (id == null) return "Unknown";
  return nameMap.value.get(id) || `#${id}`;
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatTimestamp(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

const dialogOpen = ref(false);
const saving = ref(false);
const editing = ref(null);
const form = reactive({ contents: "", channelName: "", channelId: "", hydrated: false });

/**
 * @param {object} entry
 * @returns {void}
 */
function openEdit(entry) {
  editing.value = entry;
  form.contents = entry.contents || "";
  form.channelName = entry.channelName || "";
  form.channelId = entry.channelId || "";
  form.hydrated = Boolean(entry.hydrated);
  dialogOpen.value = true;
}

/**
 * @returns {Promise<void>}
 */
async function onSave() {
  saving.value = true;
  try {
    await updatePinHistoryEntry(editing.value.id, {
      contents: form.contents,
      channelName: form.channelName,
      channelId: form.channelId,
      hydrated: form.hydrated,
    });
    notify("Pin updated");
    dialogOpen.value = false;
    await load(page.value);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to update pin", { color: "error" });
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await load(1);
  try {
    const { items: users } = await fetchUserMappings({ limit: 200 });
    nameMap.value = new Map(users.map((u) => [u.id, u.name]));
  } catch (err) {
    console.warn("Failed to load user mappings for pin archive:", err);
  }
});
</script>
