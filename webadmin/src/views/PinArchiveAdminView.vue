<template>
  <div class="view-page view-page--wide">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Pin Archive</h1>
      <p class="text-body-1 text-medium-emphasis">
        Archived pinned messages
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
            <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(entry)" />
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

    <ConfirmDialog
      v-model="confirmOpen"
      title="Delete Pin"
      message="Delete this pin from history? This cannot be undone."
      @confirm="onFirstConfirm"
      @cancel="confirmOpen = false"
    />

    <ConfirmDialog
      v-model="confirmOpen2"
      title="Are you sure?"
      message="This will permanently remove the pin and its metadata. Confirm deletion."
      confirm-label="Delete permanently"
      :loading="deleting"
      @confirm="onDelete"
      @cancel="confirmOpen2 = false"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import { usePaginatedResource } from "../composables/usePaginatedResource.js";
import { useSnackbar } from "../composables/useSnackbar.js";
import { deletePinHistoryEntry, fetchPinHistory } from "../lib/pinHistory.js";
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

const confirmOpen = ref(false);
const confirmOpen2 = ref(false);
const deleting = ref(false);
const pendingDelete = ref(null);

/**
 * @param {object} entry
 * @returns {void}
 */
function confirmDelete(entry) {
  pendingDelete.value = entry;
  confirmOpen.value = true;
}

/**
 * @returns {void}
 */
function onFirstConfirm() {
  confirmOpen.value = false;
  confirmOpen2.value = true;
}

/**
 * @returns {Promise<void>}
 */
async function onDelete() {
  deleting.value = true;
  try {
    await deletePinHistoryEntry(pendingDelete.value.id);
    notify("Pin deleted");
    confirmOpen2.value = false;
    await load(page.value);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to delete pin", { color: "error" });
  } finally {
    deleting.value = false;
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
