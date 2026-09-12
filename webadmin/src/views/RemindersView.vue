<template>
  <div class="view-page view-page--wide">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Reminders</h1>
      <p class="text-body-1 text-medium-emphasis">
        Scheduled messages across all users. New reminders are only created via the bot.
      </p>
    </header>

    <v-select
      v-model="status"
      :items="STATUS_OPTIONS"
      label="Status"
      density="comfortable"
      variant="outlined"
      style="max-width: 220px"
      class="mb-4"
      @update:model-value="() => load(1)"
    />

    <PaginatedTable
      :headers="headers"
      :items="items"
      :loading="loading"
      :error="error"
      :page="page"
      :total-pages="totalPages"
      empty-text="No reminders match."
      @update:page="load"
    >
      <template #cell-message_body="{ item }">
        <span class="text-truncate d-inline-block" style="max-width: 320px">
          {{ item.message_body }}
        </span>
      </template>
      <template #cell-scheduled_at="{ item }">{{ formatTimestamp(item.scheduled_at) }}</template>
      <template #cell-status="{ item }">
        <v-chip size="small" :color="item.status === 'sent' ? 'success' : 'warning'" variant="tonal">
          {{ item.status }}
        </v-chip>
      </template>
      <template #actions="{ item }">
        <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
      </template>
    </PaginatedTable>

    <v-dialog v-model="dialogOpen" max-width="480">
      <v-card class="glass-card">
        <v-card-title class="text-h6">Edit Reminder</v-card-title>
        <v-card-text>
          <v-textarea v-model="form.message_body" label="Message" rows="3" auto-grow class="mb-3" />
          <v-text-field v-model="form.scheduled_at" label="Scheduled at" type="datetime-local" />
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
      title="Delete Reminder"
      message="Delete this reminder? This works regardless of pending/sent status."
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
  deleteScheduledMessage,
  fetchScheduledMessages,
  updateScheduledMessage,
} from "../lib/scheduledMessages.js";

const STATUS_OPTIONS = ["all", "pending", "sent"];

const { notify } = useSnackbar();

const headers = [
  { title: "Message", key: "message_body" },
  { title: "Scheduled At", key: "scheduled_at" },
  { title: "Status", key: "status" },
];

const status = ref("all");

const { items, loading, error, page, totalPages, load } = usePaginatedResource(
  ({ limit, offset }) => fetchScheduledMessages({ status: status.value, limit, offset }),
);

const dialogOpen = ref(false);
const saving = ref(false);
const editing = ref(null);
const form = reactive({ message_body: "", scheduled_at: "" });

const confirmOpen = ref(false);
const deleting = ref(false);
const pendingDelete = ref(null);

/**
 * @param {string} iso
 * @returns {string}
 */
function formatTimestamp(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/**
 * @param {string} iso
 * @returns {string} value suitable for an <input type="datetime-local">
 */
function toDatetimeLocal(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * @param {object} item
 * @returns {void}
 */
function openEdit(item) {
  editing.value = item;
  form.message_body = item.message_body;
  form.scheduled_at = toDatetimeLocal(item.scheduled_at);
  dialogOpen.value = true;
}

/**
 * @returns {Promise<void>}
 */
async function onSave() {
  if (!form.message_body.trim()) {
    notify("Message is required", { color: "error" });
    return;
  }
  saving.value = true;
  try {
    await updateScheduledMessage(editing.value.id, {
      message_body: form.message_body.trim(),
      scheduled_at: form.scheduled_at,
    });
    notify("Reminder updated");
    dialogOpen.value = false;
    await load(page.value);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to update reminder", { color: "error" });
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
    await deleteScheduledMessage(pendingDelete.value.id);
    notify("Reminder deleted");
    confirmOpen.value = false;
    await load(page.value);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to delete reminder", { color: "error" });
  } finally {
    deleting.value = false;
  }
}

onMounted(() => load(1));
</script>
