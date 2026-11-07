<template>
  <div class="view-page view-page--wide">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Emoji/Sticker Catalog</h1>
      <p class="text-body-1 text-medium-emphasis">Browse, rename, re-image, or remove any synced emoji/sticker</p>
    </header>

    <div class="d-flex flex-wrap ga-4 mb-4">
      <v-select
        v-model="filters.app"
        :items="appOptions"
        label="App"
        density="comfortable"
        variant="outlined"
        style="min-width: 160px"
        @update:model-value="onFilterChange"
      />
      <v-select
        v-model="filters.type"
        :items="typeOptions"
        label="Type"
        density="comfortable"
        variant="outlined"
        style="min-width: 160px"
        @update:model-value="onFilterChange"
      />
      <v-select
        v-model="filters.animated"
        :items="animatedOptions"
        label="Animation"
        density="comfortable"
        variant="outlined"
        style="min-width: 160px"
        @update:model-value="onFilterChange"
      />
      <v-text-field
        v-model="filters.name"
        label="Search name"
        density="comfortable"
        variant="outlined"
        prepend-inner-icon="mdi-magnify"
        clearable
        style="min-width: 220px"
        @update:model-value="onNameInput"
      />
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" :text="error" />
    <v-skeleton-loader v-if="loading" type="card@8" />

    <template v-else>
      <p v-if="!items.length" class="text-body-2 text-medium-emphasis">No emojis/stickers match.</p>
      <v-row v-else>
        <v-col v-for="item in items" :key="item.internalId" cols="12" sm="6" md="4" lg="3">
          <v-card class="glass-card emoji-card" @click="openDetail(item)">
            <div class="d-flex align-center ga-3 pa-3">
              <v-avatar size="40" rounded="lg" class="flex-shrink-0">
                <v-img :src="guildEmojiImageUrl(item.internalId)" cover>
                  <template #error>
                    <v-icon icon="mdi-image-off-outline" size="20" />
                  </template>
                </v-img>
              </v-avatar>
              <div class="flex-grow-1 text-truncate">
                <div class="text-body-2 font-weight-medium text-truncate">{{ item.name }}</div>
                <div class="text-caption text-medium-emphasis">{{ item.type ?? "unicode" }}</div>
              </div>
              <v-chip size="small" variant="tonal" class="flex-shrink-0">{{ appLabel(item.app) }}</v-chip>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <div v-if="totalPages > 1" class="d-flex justify-center mt-6">
        <v-pagination
          :model-value="page"
          :length="totalPages"
          density="compact"
          total-visible="7"
          @update:model-value="load"
        />
      </div>
    </template>

    <v-dialog v-model="detailOpen" max-width="520">
      <v-card v-if="detail" class="glass-card">
        <v-card-title class="text-h6">Guild Emoji Details</v-card-title>
        <v-card-text>
          <div class="d-flex ga-4 mb-4">
            <v-avatar size="96" rounded="lg" class="flex-shrink-0">
              <v-img :src="guildEmojiImageUrl(detail.internalId)" cover>
                <template #error>
                  <v-icon icon="mdi-image-off-outline" size="32" />
                </template>
              </v-img>
            </v-avatar>
            <div class="flex-grow-1">
              <v-text-field
                v-model="editName"
                label="Name"
                density="comfortable"
                variant="outlined"
                hide-details
              />
              <v-btn
                size="small"
                variant="tonal"
                class="mt-2"
                prepend-icon="mdi-upload"
                :loading="uploading"
                @click="triggerFilePicker"
              >
                {{ detail.imagePath ? "Replace image" : "Add image" }}
              </v-btn>
              <input
                ref="fileInput"
                type="file"
                accept="image/png,image/gif"
                class="d-none"
                @change="onFileSelected"
              />
            </div>
          </div>

          <v-list density="compact" class="glass-card">
            <v-list-item title="Internal ID" :subtitle="String(detail.internalId)" />
            <v-list-item title="Platform ID" :subtitle="detail.id" />
            <v-list-item title="App" :subtitle="appLabel(detail.app)" />
            <v-list-item title="Guild ID" :subtitle="detail.guildId ?? '(none — unicode)'" />
            <v-list-item title="Type" :subtitle="detail.type ?? 'unicode'" />
            <v-list-item title="Animated" :subtitle="detail.animated ? 'Yes' : 'No'" />
            <v-list-item title="Available" :subtitle="formatTriState(detail.available)" />
            <v-list-item title="Managed" :subtitle="formatTriState(detail.managed)" />
            <v-list-item title="Requires Colons" :subtitle="formatTriState(detail.requiresColons)" />
            <v-list-item v-if="detail.roles?.length" title="Roles" :subtitle="detail.roles.join(', ')" />
            <v-list-item title="Usage Frequency" :subtitle="String(detail.frequency)" />
            <v-list-item title="Last Synced" :subtitle="detail.syncedAt" />
            <v-list-item title="Image Path" :subtitle="detail.imagePath ?? '(none)'" />
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-btn color="error" variant="text" prepend-icon="mdi-delete" :loading="deleting" @click="confirmDelete(detail)">
            Delete
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="detailOpen = false">Close</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="saving"
            :disabled="editName.trim() === detail.name"
            @click="onSaveName"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      v-model="confirmOpen"
      title="Delete Guild Emoji"
      :message="confirmMessage"
      :loading="deleting"
      @confirm="onDelete"
      @cancel="confirmOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import { usePaginatedResource } from "../composables/usePaginatedResource.js";
import { useSnackbar } from "../composables/useSnackbar.js";
import { appLabel } from "../nav/clients.js";
import {
  deleteGuildEmoji,
  guildEmojiImageUrl,
  searchGuildEmojis,
  updateGuildEmoji,
  uploadGuildEmojiImage,
} from "../lib/guildEmojis.js";

const { notify } = useSnackbar();

const appOptions = [
  { title: "All apps", value: null },
  { title: "Discord Bot", value: "discord" },
  { title: "Fluxer Bot", value: "fluxer" },
];
const typeOptions = [
  { title: "All types", value: null },
  { title: "Emoji", value: "emoji" },
  { title: "Sticker", value: "sticker" },
];
const animatedOptions = [
  { title: "Any animation", value: null },
  { title: "Animated", value: true },
  { title: "Static", value: false },
];

const filters = reactive({ app: null, type: null, animated: null, name: "" });
let nameDebounce = null;

const { items, loading, error, page, totalPages, load } = usePaginatedResource(
  ({ limit, offset }) =>
    searchGuildEmojis({
      app: filters.app,
      type: filters.type,
      animated: filters.animated,
      name: filters.name.trim(),
      limit,
      offset,
    }),
  { pageSize: 24 },
);

/**
 * @returns {void}
 */
function onFilterChange() {
  load(1);
}

/**
 * @returns {void}
 */
function onNameInput() {
  if (nameDebounce) clearTimeout(nameDebounce);
  nameDebounce = setTimeout(() => load(1), 300);
}

/**
 * @param {boolean|null} value
 * @returns {string}
 */
function formatTriState(value) {
  if (value == null) return "(unknown)";
  return value ? "Yes" : "No";
}

const detailOpen = ref(false);
const detail = ref(null);
const editName = ref("");
const saving = ref(false);
const uploading = ref(false);
const fileInput = ref(null);

/**
 * @param {object} item
 * @returns {void}
 */
function openDetail(item) {
  detail.value = item;
  editName.value = item.name;
  detailOpen.value = true;
}

/**
 * @returns {Promise<void>}
 */
async function onSaveName() {
  const name = editName.value.trim();
  if (!name || name === detail.value.name) return;
  saving.value = true;
  try {
    await updateGuildEmoji(detail.value.internalId, { name });
    notify("Guild emoji updated");
    detail.value = { ...detail.value, name };
    await load(page.value);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to update guild emoji", { color: "error" });
  } finally {
    saving.value = false;
  }
}

/**
 * @returns {void}
 */
function triggerFilePicker() {
  fileInput.value?.click();
}

/**
 * @param {Event} event
 * @returns {Promise<void>}
 */
async function onFileSelected(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  uploading.value = true;
  try {
    const imagePath = await uploadGuildEmojiImage(detail.value.internalId, file);
    notify("Image uploaded");
    detail.value = { ...detail.value, imagePath };
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to upload image", { color: "error" });
  } finally {
    uploading.value = false;
  }
}

const confirmOpen = ref(false);
const deleting = ref(false);
const pendingDelete = ref(null);

const confirmMessage = computed(() => {
  if (!pendingDelete.value) return "";
  return `"${pendingDelete.value.name}" has been used ${pendingDelete.value.frequency} time(s). Delete it anyway? It will simply reappear the next time the bot syncs its catalog, but this usage history will be lost.`;
});

/**
 * @param {object} item
 * @returns {void}
 */
function confirmDelete(item) {
  if (item.frequency > 0) {
    pendingDelete.value = item;
    confirmOpen.value = true;
  } else {
    pendingDelete.value = item;
    onDelete();
  }
}

/**
 * @returns {Promise<void>}
 */
async function onDelete() {
  deleting.value = true;
  try {
    await deleteGuildEmoji(pendingDelete.value.internalId);
    notify("Guild emoji deleted");
    confirmOpen.value = false;
    detailOpen.value = false;
    await load(page.value);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to delete guild emoji", { color: "error" });
  } finally {
    deleting.value = false;
  }
}

onMounted(() => load(1));
</script>

<style scoped>
.emoji-card {
  cursor: pointer;
}
</style>
