<template>
  <div class="view-page view-page--wide">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Unmapped Users</h1>
      <p class="text-body-1 text-medium-emphasis">
        guild_members rows across every app with no member_aliases link to a chat_member_mapping identity yet.
      </p>
    </header>

    <v-text-field
      v-model="search"
      label="Search handle or nickname"
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
      empty-text="No unmapped users."
      @update:page="load"
    >
      <template #cell-id="{ item }">#{{ item.id }}</template>
      <template #cell-handle="{ item }">{{ item.handle || item.nickname || "—" }}</template>
      <template #actions="{ item }">
        <v-btn
          icon="mdi-account-multiple"
          size="small"
          variant="text"
          :loading="resolvingId === item.id"
          @click="onResolve(item)"
        />
      </template>
    </PaginatedTable>

    <MemberAliasesDialog v-model="aliasesDialogOpen" :mapping="aliasesTarget" />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import PaginatedTable from "../components/PaginatedTable.vue";
import MemberAliasesDialog from "../components/MemberAliasesDialog.vue";
import { usePaginatedResource } from "../composables/usePaginatedResource.js";
import { useSnackbar } from "../composables/useSnackbar.js";
import { fetchUnlinkedGuildMembers, linkGuildMemberAlias } from "../lib/guildMembers.js";
import { createUserMapping, setPrimaryAlias } from "../lib/userMappings.js";

const { notify } = useSnackbar();

const headers = [
  { title: "ID", key: "id" },
  { title: "App", key: "app" },
  { title: "Guild", key: "guildId" },
  { title: "Handle", key: "handle" },
  { title: "Synced At", key: "syncedAt" },
];

const search = ref("");
let searchDebounce = null;

/**
 * The unlinked-members endpoint has no server-side pagination, so page client-side over the
 * full (search-filtered) result set.
 * @param {{ limit: number, offset: number }} opts
 * @returns {Promise<{ items: Array, total: number }>}
 */
async function fetchUnmappedPage({ limit, offset }) {
  const all = await fetchUnlinkedGuildMembers({ search: search.value.trim() });
  return { items: all.slice(offset, offset + limit), total: all.length };
}

const { items, loading, error, page, totalPages, load } = usePaginatedResource(fetchUnmappedPage);

/**
 * @returns {void}
 */
function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => load(1), 300);
}

const aliasesDialogOpen = ref(false);
const aliasesTarget = ref(null);
const resolvingId = ref(null);

/**
 * Create a chat_member_mapping for this guild_member (named after its handle/nickname), link
 * it, set it as that mapping's primary alias, then open Manage Aliases so the admin can keep
 * going (link other-app aliases, rename, etc).
 * @param {{id:number,app:string,handle:string|null,nickname:string|null,platformUserId:string}} item
 * @returns {Promise<void>}
 */
async function onResolve(item) {
  resolvingId.value = item.id;
  try {
    const name = item.handle || item.nickname || item.platformUserId;
    const mapping = await createUserMapping({ name });
    await linkGuildMemberAlias(item.id, mapping.id);
    aliasesTarget.value = await setPrimaryAlias(mapping.id, item.id);
    aliasesDialogOpen.value = true;
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to create and link mapping", { color: "error" });
  } finally {
    resolvingId.value = null;
  }
}

watch(aliasesDialogOpen, (open) => {
  if (!open) load(page.value);
});

onMounted(() => load(1));
</script>
