<template>
  <div class="view-page view-page--wide">
    <header class="view-header mb-6 d-flex align-center justify-space-between flex-wrap ga-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-2">User Mappings</h1>
        <p class="text-body-1 text-medium-emphasis">Canonical identity directory</p>
      </div>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="openCreate">
        New Mapping
      </v-btn>
    </header>

    <v-text-field
      v-model="search"
      label="Search name"
      density="comfortable"
      variant="outlined"
      prepend-inner-icon="mdi-magnify"
      class="mb-4"
      clearable
      @update:model-value="onSearchInput"
    />

    <PaginatedTable
      :headers="headers"
      :items="items"
      :loading="loading"
      :error="error"
      :page="page"
      :total-pages="totalPages"
      empty-text="No user mappings match."
      @update:page="load"
    >
      <template #cell-id="{ item }">#{{ item.id }}</template>
      <template #cell-app="{ item }">
        <span v-if="item.app" class="text-medium-emphasis">{{ item.app }}</span>
      </template>
      <template #cell-handle="{ item }">
        <span v-if="item.handle" class="text-medium-emphasis">{{ item.handle }}</span>
      </template>
      <template #cell-discordHandle="{ item }">
        <span v-if="item.discordHandle" class="text-medium-emphasis">{{ item.discordHandle }}</span>
      </template>
      <template #actions="{ item }">
        <v-btn icon="mdi-account-multiple" size="small" variant="text" @click="openAliases(item)" />
        <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
      </template>
      <template #expanded="{ item }">
        <MappingAliasesPanel :mapping-id="item.id" :primary-guild-member-id="item.primaryGuildMemberId" />
      </template>
    </PaginatedTable>

    <MemberAliasesDialog v-model="aliasesDialogOpen" :mapping="aliasesTarget" />

    <v-dialog v-model="dialogOpen" max-width="560">
      <v-card class="glass-card">
        <v-card-title class="text-h6">{{ editing ? "Edit Mapping" : "New Mapping" }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" label="Display name" class="mb-4" />

          <template v-if="editing">
            <div class="text-caption text-medium-emphasis mb-2">chat_member_mapping record</div>
            <v-table density="compact" class="mapping-info-table mb-4">
              <tbody>
                <tr>
                  <td class="text-medium-emphasis">id</td>
                  <td>{{ editing.id }}</td>
                </tr>
                <tr>
                  <td class="text-medium-emphasis">handle</td>
                  <td>{{ editing.handle || "—" }}</td>
                </tr>
                <tr>
                  <td class="text-medium-emphasis">app</td>
                  <td>{{ editing.app || "—" }}</td>
                </tr>
                <tr>
                  <td class="text-medium-emphasis">primaryGuildMemberId</td>
                  <td>{{ editing.primaryGuildMemberId ?? "—" }}</td>
                </tr>
                <tr v-if="editing.discordHandle">
                  <td class="text-medium-emphasis">discordHandle (legacy)</td>
                  <td>{{ editing.discordHandle }}</td>
                </tr>
              </tbody>
            </v-table>

            <div class="text-caption text-medium-emphasis mb-2">
              Linked apps — view only; use "Manage Aliases" to link, unlink, or set the primary alias.
            </div>
            <div class="d-flex flex-wrap ga-2">
              <v-chip v-for="alias in editAliases" :key="alias.id" size="small">
                {{ alias.app }}: {{ alias.handle || alias.nickname || alias.platformUserId }}
                <span v-if="alias.id === editing.primaryGuildMemberId" class="font-weight-bold ml-1">
                  (primary)
                </span>
              </v-chip>
              <span
                v-if="!editAliasesLoading && !editAliases.length"
                class="text-caption text-medium-emphasis"
              >
                No linked guild members yet.
              </span>
            </div>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="onSave">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      v-model="confirmOpen"
      title="Delete Mapping"
      message="Delete this user mapping?"
      :loading="deleting"
      @confirm="onDelete"
      @cancel="confirmOpen = false"
    />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import PaginatedTable from "../components/PaginatedTable.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import MemberAliasesDialog from "../components/MemberAliasesDialog.vue";
import MappingAliasesPanel from "../components/MappingAliasesPanel.vue";
import { usePaginatedResource } from "../composables/usePaginatedResource.js";
import { useSnackbar } from "../composables/useSnackbar.js";
import {
  createUserMapping,
  deleteUserMapping,
  fetchUserMappings,
  updateUserMapping,
} from "../lib/userMappings.js";
import { fetchAliasesForMapping } from "../lib/guildMembers.js";

const { notify } = useSnackbar();

const headers = [
  { title: "ID", key: "id" },
  { title: "Name", key: "name" },
  { title: "App", key: "app" },
  { title: "Handle", key: "handle" },
  { title: "Discord Handle", key: "discordHandle" },
];

const aliasesDialogOpen = ref(false);
const aliasesTarget = ref(null);

/**
 * @param {{id:number,name:string,discordHandle?:string}} item
 * @returns {void}
 */
function openAliases(item) {
  aliasesTarget.value = item;
  aliasesDialogOpen.value = true;
}

const search = ref("");
let searchDebounce = null;

const { items, loading, error, page, totalPages, load } = usePaginatedResource(
  ({ limit, offset }) => fetchUserMappings({ limit, offset, search: search.value.trim() }),
);

/**
 * @returns {void}
 */
function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => load(1), 300);
}

const dialogOpen = ref(false);
const saving = ref(false);
const editing = ref(null);
const form = reactive({ name: "" });

const editAliases = ref([]);
const editAliasesLoading = ref(false);

/**
 * @param {number} mappingId
 * @returns {Promise<void>}
 */
async function loadEditAliases(mappingId) {
  editAliasesLoading.value = true;
  try {
    editAliases.value = await fetchAliasesForMapping(mappingId);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to load linked apps", { color: "error" });
  } finally {
    editAliasesLoading.value = false;
  }
}

const confirmOpen = ref(false);
const deleting = ref(false);
const pendingDelete = ref(null);

/**
 * @returns {void}
 */
function openCreate() {
  editing.value = null;
  form.name = "";
  dialogOpen.value = true;
}

/**
 * @param {{id:number,name:string}} item
 * @returns {void}
 */
function openEdit(item) {
  editing.value = item;
  form.name = item.name;
  dialogOpen.value = true;

  editAliases.value = [];
  loadEditAliases(item.id);
}

/**
 * @returns {Promise<void>}
 */
async function onSave() {
  if (!form.name.trim()) {
    notify("Name is required", { color: "error" });
    return;
  }
  saving.value = true;
  try {
    const fields = { name: form.name.trim() };
    if (editing.value) {
      await updateUserMapping(editing.value.id, fields);
      notify("Mapping updated");
    } else {
      await createUserMapping(fields);
      notify("Mapping created");
    }
    dialogOpen.value = false;
    await load(page.value);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to save mapping", { color: "error" });
  } finally {
    saving.value = false;
  }
}

/**
 * @param {{id:number}} item
 * @returns {void}
 */
function confirmDelete(item) {
  pendingDelete.value = item;
  confirmOpen.value = true;
}

/**
 * @returns {Promise<void>}
 */
async function onDelete() {
  deleting.value = true;
  try {
    await deleteUserMapping(pendingDelete.value.id);
    notify("Mapping deleted");
    confirmOpen.value = false;
    await load(page.value);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to delete mapping", { color: "error" });
  } finally {
    deleting.value = false;
  }
}

onMounted(() => load(1));
</script>

<style scoped>
.mapping-info-table {
  background: transparent !important;
}
</style>
