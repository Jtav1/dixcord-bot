<template>
  <div class="view-page">
    <header class="view-header mb-6 d-flex align-center justify-space-between flex-wrap ga-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-2">Pin Quips</h1>
        <p class="text-body-1 text-medium-emphasis">Flavor text posted alongside auto-pinned messages</p>
      </div>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="openCreate">
        New Quip
      </v-btn>
    </header>

    <PaginatedTable
      :headers="headers"
      :items="items"
      :loading="loading"
      :error="error"
      :page="1"
      :total-pages="1"
      empty-text="No pin quips yet."
    >
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
      </template>
    </PaginatedTable>

    <v-dialog v-model="dialogOpen" max-width="480">
      <v-card class="glass-card">
        <v-card-title class="text-h6">{{ editing ? "Edit Quip" : "New Quip" }}</v-card-title>
        <v-card-text>
          <v-textarea v-model="form.quip" label="Quip text" rows="2" auto-grow />
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
      title="Delete Quip"
      message="Delete this pin quip?"
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
  createPinQuip,
  deletePinQuip,
  fetchPinQuips,
  updatePinQuip,
} from "../lib/pinQuips.js";

const { notify } = useSnackbar();

const headers = [{ title: "Quip", key: "quip" }];

const loading = ref(true);
const error = ref("");
/** @type {import("vue").Ref<Array<{id:number,quip:string}>>} */
const items = ref([]);

const dialogOpen = ref(false);
const saving = ref(false);
const editing = ref(null);
const form = reactive({ quip: "" });

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
    items.value = await fetchPinQuips();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load pin quips";
  } finally {
    loading.value = false;
  }
}

/**
 * @returns {void}
 */
function openCreate() {
  editing.value = null;
  form.quip = "";
  dialogOpen.value = true;
}

/**
 * @param {{id:number,quip:string}} item
 * @returns {void}
 */
function openEdit(item) {
  editing.value = item;
  form.quip = item.quip;
  dialogOpen.value = true;
}

/**
 * @returns {Promise<void>}
 */
async function onSave() {
  if (!form.quip.trim()) {
    notify("Quip text is required", { color: "error" });
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      await updatePinQuip(editing.value.id, form.quip.trim());
      notify("Quip updated");
    } else {
      await createPinQuip(form.quip.trim());
      notify("Quip created");
    }
    dialogOpen.value = false;
    await load();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to save quip", { color: "error" });
  } finally {
    saving.value = false;
  }
}

/**
 * @param {{id:number,quip:string}} item
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
    await deletePinQuip(pendingDelete.value.id);
    notify("Quip deleted");
    confirmOpen.value = false;
    await load();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to delete quip", { color: "error" });
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
</script>
