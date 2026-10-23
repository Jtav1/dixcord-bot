<template>
  <v-dialog v-model="internalOpen" max-width="720">
    <v-card class="glass-card">
      <v-card-title class="text-h6">
        Manage Aliases — #{{ mapping?.id }} {{ mapping?.name }}
      </v-card-title>
      <v-card-subtitle v-if="mapping?.discordHandle">{{ mapping.discordHandle }}</v-card-subtitle>

      <v-card-text>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4" :text="error" />

        <h3 class="text-subtitle-1 font-weight-bold mb-2">Current Aliases</h3>
        <v-skeleton-loader v-if="loadingAliases" type="list-item-two-line@2" class="mb-4" />
        <template v-else-if="aliases.length">
          <v-list density="comfortable" class="glass-card mb-4">
            <v-list-item v-for="alias in aliases" :key="alias.id">
              <v-list-item-title>
                {{ alias.handle || alias.nickname || alias.platformUserId }}
                <v-chip v-if="alias.id === mapping?.primaryGuildMemberId" size="x-small" color="primary" variant="tonal" class="ml-1">
                  primary
                </v-chip>
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ alias.guildName || alias.guildId }} · {{ alias.platformUserId }}
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  icon="mdi-link-off"
                  size="small"
                  variant="text"
                  color="error"
                  :loading="unlinkingId === alias.id"
                  @click="onUnlink(alias)"
                />
              </template>
            </v-list-item>
          </v-list>

          <v-select
            v-model="selectedPrimaryId"
            :items="primaryAliasItems"
            label="Primary account"
            density="comfortable"
            variant="outlined"
            hide-details
            :loading="settingPrimary"
            class="mb-4"
            @update:model-value="onSetPrimary"
          />
        </template>
        <p v-else class="text-body-2 text-medium-emphasis mb-4">No aliases linked yet.</p>

        <h3 class="text-subtitle-1 font-weight-bold mb-2">Link an Unlinked Member</h3>
        <v-text-field
          v-model="search"
          label="Search handle or nickname"
          density="comfortable"
          variant="outlined"
          prepend-inner-icon="mdi-magnify"
          clearable
          class="mb-2"
          @update:model-value="onSearchInput"
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
                icon="mdi-link"
                size="small"
                variant="text"
                color="primary"
                :loading="linkingId === candidate.id"
                @click="onLink(candidate)"
              />
            </template>
          </v-list-item>
        </v-list>
        <p v-else class="text-body-2 text-medium-emphasis">
          {{ search ? "No unlinked members match." : "No unlinked members." }}
        </p>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="internalOpen = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useSnackbar } from "../composables/useSnackbar.js";
import {
  fetchAliasesForMapping,
  fetchUnlinkedGuildMembers,
  linkGuildMemberAlias,
  unlinkGuildMemberAlias,
} from "../lib/guildMembers.js";
import { setPrimaryAlias } from "../lib/userMappings.js";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  mapping: { type: Object, default: null },
});

const emit = defineEmits(["update:modelValue"]);

const { notify } = useSnackbar();

const internalOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const aliases = ref([]);
const loadingAliases = ref(false);
const error = ref("");

const search = ref("");
const candidates = ref([]);
const loadingCandidates = ref(false);
let searchDebounce = null;

const linkingId = ref(null);
const unlinkingId = ref(null);

const selectedPrimaryId = ref(null);
const settingPrimary = ref(false);

const primaryAliasItems = computed(() =>
  aliases.value.map((alias) => ({
    title: `${alias.app} · ${alias.handle || alias.nickname || alias.platformUserId}`,
    value: alias.id,
  })),
);

/**
 * @returns {Promise<void>}
 */
async function loadAliases() {
  if (!props.mapping) return;
  loadingAliases.value = true;
  error.value = "";
  try {
    aliases.value = await fetchAliasesForMapping(props.mapping.id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load aliases";
  } finally {
    loadingAliases.value = false;
  }
}

/**
 * @param {number} guildMemberId
 * @returns {Promise<void>}
 */
async function onSetPrimary(guildMemberId) {
  if (!guildMemberId || !props.mapping) return;
  settingPrimary.value = true;
  try {
    const updated = await setPrimaryAlias(props.mapping.id, guildMemberId);
    props.mapping.handle = updated.handle;
    props.mapping.app = updated.app;
    props.mapping.primaryGuildMemberId = updated.primaryGuildMemberId;
    notify("Primary account set");
  } catch (err) {
    selectedPrimaryId.value = props.mapping.primaryGuildMemberId ?? null;
    notify(err instanceof Error ? err.message : "Failed to set primary account", { color: "error" });
  } finally {
    settingPrimary.value = false;
  }
}

/**
 * @returns {Promise<void>}
 */
async function loadCandidates() {
  loadingCandidates.value = true;
  try {
    candidates.value = await fetchUnlinkedGuildMembers({ search: search.value.trim() });
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to load unlinked members", { color: "error" });
  } finally {
    loadingCandidates.value = false;
  }
}

/**
 * @returns {void}
 */
function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadCandidates, 300);
}

/**
 * @param {{id:number}} candidate
 * @returns {Promise<void>}
 */
async function onLink(candidate) {
  linkingId.value = candidate.id;
  try {
    await linkGuildMemberAlias(candidate.id, props.mapping.id);
    notify("Member linked");
    await Promise.all([loadAliases(), loadCandidates()]);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to link member", { color: "error" });
  } finally {
    linkingId.value = null;
  }
}

/**
 * @param {{id:number}} alias
 * @returns {Promise<void>}
 */
async function onUnlink(alias) {
  unlinkingId.value = alias.id;
  try {
    await unlinkGuildMemberAlias(alias.id);
    if (props.mapping && alias.id === props.mapping.primaryGuildMemberId) {
      props.mapping.handle = undefined;
      props.mapping.app = undefined;
      props.mapping.primaryGuildMemberId = undefined;
      selectedPrimaryId.value = null;
    }
    notify("Member unlinked");
    await Promise.all([loadAliases(), loadCandidates()]);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to unlink member", { color: "error" });
  } finally {
    unlinkingId.value = null;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    search.value = "";
    selectedPrimaryId.value = props.mapping?.primaryGuildMemberId ?? null;
    loadAliases();
    loadCandidates();
  },
);
</script>
