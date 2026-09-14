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
      <template #cell-discordHandle="{ item }">
        <span v-if="item.discordHandle" class="text-medium-emphasis">{{ item.discordHandle }}</span>
      </template>
      <template #actions="{ item }">
        <v-btn icon="mdi-account-multiple" size="small" variant="text" @click="openAliases(item)" />
        <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEdit(item)" />
        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="confirmDelete(item)" />
      </template>
      <template #expanded="{ item }">
        <MappingAliasesPanel :mapping-id="item.id" />
      </template>
    </PaginatedTable>

    <MemberAliasesDialog v-model="aliasesDialogOpen" :mapping="aliasesTarget" />

    <v-dialog v-model="dialogOpen" max-width="560">
      <v-card class="glass-card">
        <v-card-title class="text-h6">{{ editing ? "Edit Mapping" : "New Mapping" }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" label="Display name" class="mb-4" />

          <template v-if="editing">
            <div class="text-caption text-medium-emphasis mb-2">Linked apps</div>
            <div class="d-flex flex-wrap ga-2 mb-4">
              <v-chip
                v-for="alias in editAliases"
                :key="alias.id"
                size="small"
                closable
                :loading="unlinkingAliasId === alias.id"
                @click:close="onUnlinkEditAlias(alias)"
              >
                {{ alias.app }}: {{ alias.handle || alias.nickname || alias.platformUserId }}
              </v-chip>
              <span
                v-if="!editAliasesLoading && !editAliases.length"
                class="text-caption text-medium-emphasis"
              >
                No linked guild members yet.
              </span>
            </div>

            <v-autocomplete
              v-model="selectedLinkId"
              v-model:search="linkSearch"
              :items="linkCandidateItems"
              :loading="linkCandidatesLoading"
              label="Link a guild member"
              density="comfortable"
              variant="outlined"
              clearable
              hide-details
              class="mb-2"
            />
            <div class="d-flex justify-end mb-2">
              <v-btn
                size="small"
                color="primary"
                variant="tonal"
                :disabled="!selectedLinkId"
                :loading="linking"
                @click="onLinkFromEdit"
              >
                Link
              </v-btn>
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
import { computed, onMounted, reactive, ref, watch } from "vue";
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
import {
  fetchAliasesForMapping,
  fetchAllGuildMemberRows,
  linkGuildMemberAlias,
  unlinkGuildMemberAlias,
} from "../lib/guildMembers.js";

const { notify } = useSnackbar();

const headers = [
  { title: "ID", key: "id" },
  { title: "Name", key: "name" },
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
const unlinkingAliasId = ref(null);

const linkSearch = ref("");
const linkCandidates = ref([]);
const linkCandidatesLoading = ref(false);
const selectedLinkId = ref(null);
const linking = ref(false);
let linkSearchDebounce = null;

const linkCandidateItems = computed(() =>
  linkCandidates.value
    .filter((member) => member.linkedMappingId !== editing.value?.id)
    .map((member) => ({
      title: `${member.app} · ${member.handle || member.nickname || member.platformUserId}${
        member.linkedMappingName ? ` (linked: ${member.linkedMappingName})` : ""
      }`,
      value: member.id,
    })),
);

watch(linkSearch, () => {
  if (linkSearchDebounce) clearTimeout(linkSearchDebounce);
  linkSearchDebounce = setTimeout(loadLinkCandidates, 300);
});

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

/**
 * @returns {Promise<void>}
 */
async function loadLinkCandidates() {
  linkCandidatesLoading.value = true;
  try {
    linkCandidates.value = await fetchAllGuildMemberRows({ search: linkSearch.value.trim() });
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to load guild members", { color: "error" });
  } finally {
    linkCandidatesLoading.value = false;
  }
}

/**
 * @returns {Promise<void>}
 */
async function onLinkFromEdit() {
  if (!selectedLinkId.value || !editing.value) return;
  linking.value = true;
  try {
    await linkGuildMemberAlias(selectedLinkId.value, editing.value.id);
    notify("Member linked");
    selectedLinkId.value = null;
    linkSearch.value = "";
    await Promise.all([loadEditAliases(editing.value.id), loadLinkCandidates()]);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to link member", { color: "error" });
  } finally {
    linking.value = false;
  }
}

/**
 * @param {{id:number}} alias
 * @returns {Promise<void>}
 */
async function onUnlinkEditAlias(alias) {
  unlinkingAliasId.value = alias.id;
  try {
    await unlinkGuildMemberAlias(alias.id);
    notify("Member unlinked");
    await Promise.all([loadEditAliases(editing.value.id), loadLinkCandidates()]);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to unlink member", { color: "error" });
  } finally {
    unlinkingAliasId.value = null;
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
  linkSearch.value = "";
  linkCandidates.value = [];
  selectedLinkId.value = null;
  loadEditAliases(item.id);
  loadLinkCandidates();
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
