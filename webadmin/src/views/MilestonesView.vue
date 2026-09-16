<template>
  <div class="view-page">
    <header class="view-header mb-6 d-flex align-center justify-space-between flex-wrap ga-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-2">Milestones</h1>
        <p class="text-body-1 text-medium-emphasis">Achievement thresholds that trigger a notification message</p>
      </div>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="openCreate">
        New Milestone
      </v-btn>
    </header>

    <PaginatedTable
      :headers="headers"
      :items="items"
      :loading="loading"
      :error="error"
      :page="1"
      :total-pages="1"
      empty-text="No milestones yet."
    >
      <template #cell-type="{ item }">
        {{ typeLabel(item.type) }}
      </template>
      <template #cell-achieved="{ item }">
        <v-chip :color="item.achieved ? 'success' : undefined" size="small" variant="tonal">
          {{ item.achieved ? "Achieved" : "Pending" }}
        </v-chip>
      </template>
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
      </template>
    </PaginatedTable>

    <h2 class="text-h6 font-weight-bold mt-8 mb-2">Global Milestones</h2>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Milestones that apply server-wide (no specific item), sorted by type then quantity
    </p>
    <PaginatedTable
      :headers="globalHeaders"
      :items="globalMilestones"
      :loading="loading"
      :page="1"
      :total-pages="1"
      empty-text="No global milestones yet."
    >
      <template #cell-type="{ item }">
        {{ typeLabel(item.type) }}
      </template>
      <template #cell-achieved="{ item }">
        <v-chip :color="item.achieved ? 'success' : undefined" size="small" variant="tonal">
          {{ item.achieved ? "Achieved" : "Pending" }}
        </v-chip>
      </template>
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
      </template>
    </PaginatedTable>

    <v-dialog v-model="dialogOpen" max-width="560">
      <v-card class="glass-card">
        <v-card-title class="text-h6">{{ editing ? "Edit Milestone" : "New Milestone" }}</v-card-title>
        <v-card-text>
          <v-select
            v-model="form.type"
            label="Type"
            :items="typeItems"
            :loading="typesLoading"
            item-title="title"
            item-value="value"
          />
          <v-text-field v-model.number="form.quantity" label="Quantity" type="number" min="0" />
          <v-text-field
            v-if="itemRequired"
            v-model="form.item"
            label="Item"
            :hint="selectedTypeDescription"
            persistent-hint
          />
          <v-textarea v-model="form.message" label="Message" rows="2" auto-grow class="mt-2" />
          <v-text-field v-model="form.object" label="Object" hint="Free-form display category" persistent-hint />
          <v-switch
            v-if="editing"
            v-model="form.achieved"
            label="Achieved"
            color="success"
            density="compact"
            class="mt-2"
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
      title="Delete Milestone"
      message="Delete this milestone?"
      :loading="deleting"
      @confirm="onDelete"
      @cancel="confirmOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import PaginatedTable from "../components/PaginatedTable.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import { useSnackbar } from "../composables/useSnackbar.js";
import {
  createMilestone,
  deleteMilestone,
  fetchMilestoneTypes,
  fetchMilestones,
  updateMilestone,
} from "../lib/milestones.js";

const { notify } = useSnackbar();

const headers = [
  { title: "Type", key: "type" },
  { title: "Quantity", key: "quantity" },
  { title: "Item", key: "item" },
  { title: "Message", key: "message" },
  { title: "Object", key: "object" },
  { title: "Status", key: "achieved" },
];

const globalHeaders = [
  { title: "Type", key: "type" },
  { title: "Quantity", key: "quantity" },
  { title: "Message", key: "message" },
  { title: "Object", key: "object" },
  { title: "Status", key: "achieved" },
];

const loading = ref(true);
const error = ref("");
/** @type {import("vue").Ref<Array<object>>} */
const items = ref([]);

const typesLoading = ref(true);
/** @type {import("vue").Ref<Record<string,{itemRequired:boolean,description:string}>>} */
const types = ref({});

const typeItems = computed(() =>
  Object.entries(types.value).map(([value, meta]) => ({
    title: `${value} — ${meta.description}`,
    value,
  })),
);

const globalMilestones = computed(() =>
  items.value
    .filter((item) => item.item == null)
    .slice()
    .sort((a, b) => a.type.localeCompare(b.type) || a.quantity - b.quantity),
);

const itemRequired = computed(() => Boolean(types.value[form.type]?.itemRequired));
const selectedTypeDescription = computed(() => types.value[form.type]?.description ?? "");

const dialogOpen = ref(false);
const saving = ref(false);
const editing = ref(null);
const form = reactive({
  type: "",
  quantity: 0,
  item: "",
  message: "",
  object: "",
  achieved: false,
});

const confirmOpen = ref(false);
const deleting = ref(false);
const pendingDelete = ref(null);

/**
 * @param {string} type
 * @returns {string}
 */
function typeLabel(type) {
  return types.value[type]?.description ? `${type} — ${types.value[type].description}` : type;
}

/**
 * @returns {Promise<void>}
 */
async function load() {
  loading.value = true;
  error.value = "";
  try {
    items.value = await fetchMilestones();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load milestones";
  } finally {
    loading.value = false;
  }
}

/**
 * @returns {Promise<void>}
 */
async function loadTypes() {
  typesLoading.value = true;
  try {
    types.value = await fetchMilestoneTypes();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to load milestone types", { color: "error" });
  } finally {
    typesLoading.value = false;
  }
}

/**
 * @returns {void}
 */
function openCreate() {
  editing.value = null;
  form.type = Object.keys(types.value)[0] ?? "";
  form.quantity = 0;
  form.item = "";
  form.message = "";
  form.object = "";
  form.achieved = false;
  dialogOpen.value = true;
}

/**
 * @param {object} item
 * @returns {void}
 */
function openEdit(item) {
  editing.value = item;
  form.type = item.type;
  form.quantity = item.quantity;
  form.item = item.item ?? "";
  form.message = item.message;
  form.object = item.object;
  form.achieved = Boolean(item.achieved);
  dialogOpen.value = true;
}

/**
 * @returns {Promise<void>}
 */
async function onSave() {
  if (!form.type) {
    notify("Type is required", { color: "error" });
    return;
  }
  if (!Number.isInteger(form.quantity) || form.quantity < 0) {
    notify("Quantity must be a non-negative integer", { color: "error" });
    return;
  }
  if (itemRequired.value && !form.item.trim()) {
    notify("Item is required for this type", { color: "error" });
    return;
  }
  if (!form.message.trim()) {
    notify("Message is required", { color: "error" });
    return;
  }
  if (!form.object.trim()) {
    notify("Object is required", { color: "error" });
    return;
  }

  const payload = {
    type: form.type,
    quantity: form.quantity,
    item: itemRequired.value ? form.item.trim() : null,
    message: form.message.trim(),
    object: form.object.trim(),
  };

  saving.value = true;
  try {
    if (editing.value) {
      await updateMilestone(editing.value.id, { ...payload, achieved: form.achieved });
      notify("Milestone updated");
    } else {
      await createMilestone(payload);
      notify("Milestone created");
    }
    dialogOpen.value = false;
    await load();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to save milestone", { color: "error" });
  } finally {
    saving.value = false;
  }
}

/**
 * @param {object} item
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
    await deleteMilestone(pendingDelete.value.id);
    notify("Milestone deleted");
    confirmOpen.value = false;
    await load();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to delete milestone", { color: "error" });
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  load();
  loadTypes();
});
</script>
