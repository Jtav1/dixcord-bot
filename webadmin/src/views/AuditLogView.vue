<template>
  <div class="view-page view-page--wide">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Audit Log</h1>
      <p class="text-body-1 text-medium-emphasis">
        Every admin-panel config, content, and mutation action
      </p>
    </header>

    <PaginatedTable
      :headers="headers"
      :items="items"
      :loading="loading"
      :error="error"
      :page="page"
      :total-pages="totalPages"
      empty-text="No audit log entries yet."
      @update:page="load"
    >
      <template #cell-created_at="{ item }">{{ formatTimestamp(item.created_at) }}</template>
      <template #cell-action="{ item }">
        <v-chip size="small" :color="actionColor(item.action)" variant="tonal">
          {{ item.action }}
        </v-chip>
      </template>
      <template #cell-details="{ item }">
        <code class="text-caption">{{ JSON.stringify(item.details) }}</code>
      </template>
    </PaginatedTable>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import PaginatedTable from "../components/PaginatedTable.vue";
import { usePaginatedResource } from "../composables/usePaginatedResource.js";
import { fetchAuditLog } from "../lib/auditLog.js";

const headers = [
  { title: "When", key: "created_at" },
  { title: "Admin", key: "user_email" },
  { title: "Action", key: "action" },
  { title: "Resource", key: "resource" },
  { title: "Resource ID", key: "resource_id" },
  { title: "Details", key: "details" },
];

const { items, loading, error, page, totalPages, load } = usePaginatedResource(fetchAuditLog);

/**
 * @param {string} iso
 * @returns {string}
 */
function formatTimestamp(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/**
 * @param {string} action
 * @returns {string}
 */
function actionColor(action) {
  if (action === "create") return "success";
  if (action === "delete") return "error";
  return "info";
}

onMounted(() => load(1));
</script>
