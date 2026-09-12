<template>
  <div class="view-page">
    <header class="view-header mb-6 d-flex align-center justify-space-between flex-wrap ga-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-2">Link Replacements</h1>
        <p class="text-body-1 text-medium-emphasis">
          Hostname rewrites applied by the social-link fixer
        </p>
      </div>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="openCreate">
        New Replacement
      </v-btn>
    </header>

    <PaginatedTable
      :headers="headers"
      :items="items"
      :loading="loading"
      :error="error"
      :page="1"
      :total-pages="1"
      empty-text="No link replacements yet."
    >
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
      </template>
    </PaginatedTable>

    <v-dialog v-model="dialogOpen" max-width="480">
      <v-card class="glass-card">
        <v-card-title class="text-h6">{{ editing ? "Edit Replacement" : "New Replacement" }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="form.source_host"
            label="Source host"
            hint="e.g. twitter.com — no scheme, path, or port"
            persistent-hint
            class="mb-3"
          />
          <v-text-field
            v-model="form.target_host"
            label="Target host"
            hint="e.g. fxtwitter.com — no scheme, path, or port"
            persistent-hint
          />
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
      title="Delete Replacement"
      message="Delete this link replacement?"
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
import { useSnackbar } from "../composables/useSnackbar.js";
import {
  createLinkReplacement,
  deleteLinkReplacement,
  fetchLinkReplacements,
  updateLinkReplacement,
} from "../lib/linkReplacements.js";

const { notify } = useSnackbar();

const headers = [
  { title: "Source Host", key: "source_host" },
  { title: "Target Host", key: "target_host" },
];

const loading = ref(true);
const error = ref("");
/** @type {import("vue").Ref<Array<{id:number,source_host:string,target_host:string}>>} */
const items = ref([]);

const dialogOpen = ref(false);
const saving = ref(false);
const editing = ref(null);
const form = reactive({ source_host: "", target_host: "" });

const confirmOpen = ref(false);
const deleting = ref(false);
const pendingDelete = ref(null);

/**
 * @returns {Promise<void>}
 */
async function load() {
  loading.value = true;
  error.value = "";
  try {
    items.value = await fetchLinkReplacements();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load link replacements";
  } finally {
    loading.value = false;
  }
}

/**
 * @returns {void}
 */
function openCreate() {
  editing.value = null;
  form.source_host = "";
  form.target_host = "";
  dialogOpen.value = true;
}

/**
 * @param {{id:number,source_host:string,target_host:string}} item
 * @returns {void}
 */
function openEdit(item) {
  editing.value = item;
  form.source_host = item.source_host;
  form.target_host = item.target_host;
  dialogOpen.value = true;
}

/**
 * @returns {Promise<void>}
 */
async function onSave() {
  if (!form.source_host.trim() || !form.target_host.trim()) {
    notify("Source and target host are required", { color: "error" });
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      await updateLinkReplacement(editing.value.id, {
        source_host: form.source_host.trim(),
        target_host: form.target_host.trim(),
      });
      notify("Replacement updated");
    } else {
      await createLinkReplacement(form.source_host.trim(), form.target_host.trim());
      notify("Replacement created");
    }
    dialogOpen.value = false;
    await load();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to save replacement", { color: "error" });
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
    await deleteLinkReplacement(pendingDelete.value.id);
    notify("Replacement deleted");
    confirmOpen.value = false;
    await load();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to delete replacement", { color: "error" });
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
</script>
