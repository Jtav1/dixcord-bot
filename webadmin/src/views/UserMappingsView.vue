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
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
      </template>
    </PaginatedTable>

    <v-dialog v-model="dialogOpen" max-width="480">
      <v-card class="glass-card">
        <v-card-title class="text-h6">{{ editing ? "Edit Mapping" : "New Mapping" }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" label="Display name" />
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
import { usePaginatedResource } from "../composables/usePaginatedResource.js";
import { useSnackbar } from "../composables/useSnackbar.js";
import {
  createUserMapping,
  deleteUserMapping,
  fetchUserMappings,
  updateUserMapping,
} from "../lib/userMappings.js";

const { notify } = useSnackbar();

const headers = [
  { title: "Name", key: "name" },
];

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
