<template>
  <div class="view-page">
    <header class="view-header mb-6 d-flex align-center justify-space-between flex-wrap ga-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-2">8-Ball Responses</h1>
        <p class="text-body-1 text-medium-emphasis">Fortune replies used by the 8-ball feature</p>
      </div>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="openCreate">
        New Response
      </v-btn>
    </header>

    <PaginatedTable
      :headers="headers"
      :items="items"
      :loading="loading"
      :error="error"
      :page="1"
      :total-pages="1"
      empty-text="No 8-ball responses yet."
    >
      <template #cell-sentiment="{ item }">
        <v-chip size="small" :color="sentimentColor(item.sentiment)" variant="tonal">
          {{ item.sentiment }}
        </v-chip>
      </template>
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
      </template>
    </PaginatedTable>

    <v-dialog v-model="dialogOpen" max-width="480">
      <v-card class="glass-card">
        <v-card-title class="text-h6">{{ editing ? "Edit Response" : "New Response" }}</v-card-title>
        <v-card-text>
          <v-textarea v-model="form.response_string" label="Response text" rows="2" auto-grow class="mb-3" />
          <v-select v-model="form.sentiment" :items="SENTIMENTS" label="Sentiment" />
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
      title="Delete Response"
      message="Delete this 8-ball response?"
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
  createEightBallResponse,
  deleteEightBallResponse,
  fetchEightBallResponses,
  updateEightBallResponse,
} from "../lib/eightBallResponses.js";

const SENTIMENTS = ["positive", "negative", "neutral"];

const { notify } = useSnackbar();

const headers = [
  { title: "Response", key: "response_string" },
  { title: "Sentiment", key: "sentiment" },
  { title: "Frequency", key: "frequency" },
];

const loading = ref(true);
const error = ref("");
/** @type {import("vue").Ref<Array<{id:number,response_string:string,sentiment:string,frequency:number}>>} */
const items = ref([]);

const dialogOpen = ref(false);
const saving = ref(false);
const editing = ref(null);
const form = reactive({ response_string: "", sentiment: "neutral" });

const confirmOpen = ref(false);
const deleting = ref(false);
const pendingDelete = ref(null);

/**
 * @param {string} sentiment
 * @returns {string}
 */
function sentimentColor(sentiment) {
  if (sentiment === "positive") return "success";
  if (sentiment === "negative") return "error";
  return "medium-emphasis";
}

/**
 * @returns {Promise<void>}
 */
async function load() {
  loading.value = true;
  error.value = "";
  try {
    items.value = await fetchEightBallResponses();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load responses";
  } finally {
    loading.value = false;
  }
}

/**
 * @returns {void}
 */
function openCreate() {
  editing.value = null;
  form.response_string = "";
  form.sentiment = "neutral";
  dialogOpen.value = true;
}

/**
 * @param {{id:number,response_string:string,sentiment:string}} item
 * @returns {void}
 */
function openEdit(item) {
  editing.value = item;
  form.response_string = item.response_string;
  form.sentiment = item.sentiment;
  dialogOpen.value = true;
}

/**
 * @returns {Promise<void>}
 */
async function onSave() {
  if (!form.response_string.trim()) {
    notify("Response text is required", { color: "error" });
    return;
  }
  saving.value = true;
  try {
    if (editing.value) {
      await updateEightBallResponse(editing.value.id, {
        response_string: form.response_string.trim(),
        sentiment: form.sentiment,
      });
      notify("Response updated");
    } else {
      await createEightBallResponse(form.response_string.trim(), form.sentiment);
      notify("Response created");
    }
    dialogOpen.value = false;
    await load();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to save response", { color: "error" });
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
    await deleteEightBallResponse(pendingDelete.value.id);
    notify("Response deleted");
    confirmOpen.value = false;
    await load();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to delete response", { color: "error" });
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
</script>
