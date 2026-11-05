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
      label="Search handle"
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
        <span v-else class="text-caption text-medium-emphasis">(no aliases)</span>
      </template>
      <template #actions="{ item }">
        <v-btn icon="mdi-account-multiple" size="small" variant="text" @click="openAliases(item)" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
      </template>
      <template #expanded="{ item }">
        <MappingAliasesPanel :mapping-id="item.id" :default-guild-member-id="item.defaultGuildMemberId" />
      </template>
    </PaginatedTable>

    <MemberAliasesDialog v-model="aliasesDialogOpen" :mapping="aliasesTarget" />

    <v-dialog v-model="createDialogOpen" max-width="560">
      <v-card class="glass-card">
        <v-card-title class="text-h6">New Mapping</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Pick an unlinked guild member to seed the new identity — it becomes the mapping's
            first (and default) alias.
          </p>
          <v-text-field
            v-model="candidateSearch"
            label="Search handle or nickname"
            density="comfortable"
            variant="outlined"
            prepend-inner-icon="mdi-magnify"
            clearable
            class="mb-2"
            @update:model-value="onCandidateSearchInput"
          />
          <v-skeleton-loader v-if="loadingCandidates" type="list-item-two-line@2" />
          <v-list v-else-if="candidates.length" density="comfortable" class="glass-card">
            <v-list-item v-for="candidate in candidates" :key="candidate.id">
              <v-list-item-title>
                {{ candidate.handle || candidate.nickname || candidate.platformUserId }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ candidate.app }} · {{ candidate.guildId }} · {{ candidate.platformUserId }}
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  icon="mdi-plus"
                  size="small"
                  variant="text"
                  color="primary"
                  :loading="creatingId === candidate.id"
                  @click="onCreate(candidate)"
                />
              </template>
            </v-list-item>
          </v-list>
          <p v-else class="text-body-2 text-medium-emphasis">
            {{ candidateSearch ? "No unlinked members match." : "No unlinked members." }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="createDialogOpen = false">Close</v-btn>
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
import { onMounted, ref, watch } from "vue";
import PaginatedTable from "../components/PaginatedTable.vue";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import MemberAliasesDialog from "../components/MemberAliasesDialog.vue";
import MappingAliasesPanel from "../components/MappingAliasesPanel.vue";
import { usePaginatedResource } from "../composables/usePaginatedResource.js";
import { useSnackbar } from "../composables/useSnackbar.js";
import { createUserMapping, deleteUserMapping, fetchUserMappings } from "../lib/userMappings.js";
import { fetchUnlinkedGuildMembers } from "../lib/guildMembers.js";

const { notify } = useSnackbar();

const headers = [
  { title: "ID", key: "id" },
  { title: "App", key: "app" },
  { title: "Handle", key: "handle" },
];

const aliasesDialogOpen = ref(false);
const aliasesTarget = ref(null);

/**
 * @param {{id:number,handle:string|null,app:string|null,defaultGuildMemberId:number|null}} item
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

watch(aliasesDialogOpen, (open) => {
  if (!open) load(page.value);
});

/**
 * @returns {void}
 */
function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => load(1), 300);
}

const createDialogOpen = ref(false);
const candidateSearch = ref("");
const candidates = ref([]);
const loadingCandidates = ref(false);
const creatingId = ref(null);
let candidateSearchDebounce = null;

/**
 * @returns {Promise<void>}
 */
async function loadCandidates() {
  loadingCandidates.value = true;
  try {
    candidates.value = await fetchUnlinkedGuildMembers({ search: candidateSearch.value.trim() });
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to load unlinked members", { color: "error" });
  } finally {
    loadingCandidates.value = false;
  }
}

/**
 * @returns {void}
 */
function onCandidateSearchInput() {
  if (candidateSearchDebounce) clearTimeout(candidateSearchDebounce);
  candidateSearchDebounce = setTimeout(loadCandidates, 300);
}

/**
 * @returns {void}
 */
function openCreate() {
  candidateSearch.value = "";
  candidates.value = [];
  createDialogOpen.value = true;
  loadCandidates();
}

/**
 * @param {{id:number}} candidate
 * @returns {Promise<void>}
 */
async function onCreate(candidate) {
  creatingId.value = candidate.id;
  try {
    const mapping = await createUserMapping({ guildMemberId: candidate.id });
    notify("Mapping created");
    createDialogOpen.value = false;
    await load(page.value);
    openAliases(mapping);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to create mapping", { color: "error" });
  } finally {
    creatingId.value = null;
  }
}

const confirmOpen = ref(false);
const deleting = ref(false);
const pendingDelete = ref(null);

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
