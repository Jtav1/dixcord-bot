<template>
  <div>
    <template v-if="loading">
      <v-skeleton-loader
        v-for="n in skeletonCount"
        :key="`timeout-skeleton-${n}`"
        type="list-item-two-line"
        class="mb-2"
      />
    </template>

    <p
      v-else-if="entries.length === 0"
      class="text-body-2 text-medium-emphasis text-center py-8"
    >
      No timeouts recorded yet.
    </p>

    <template v-else>
      <v-expansion-panels v-model="expandedKey" variant="accordion" class="timeout-panels">
        <v-expansion-panel
          v-for="entry in entries"
          :key="entry.id"
          :value="entry.id"
          class="timeout-panel"
        >
          <v-expansion-panel-title class="timeout-panel-title">
            <span class="d-flex align-center ga-2 flex-grow-1 flex-wrap">
              <UserIdentityChip v-bind="identityFor(entry.target)" />
              <span class="text-caption text-medium-emphasis">
                timed out {{ formatTimeoutDuration(entry.durationSeconds) }} — {{ formatTimeoutTimestamp(entry.timestamp) }}
              </span>
            </span>
            <span class="font-weight-bold ml-3">{{ entry.voteWeightTotal }} votes</span>
          </v-expansion-panel-title>

          <v-expansion-panel-text>
            <div v-if="isVotersLoading(entry)" class="py-4">
              <v-skeleton-loader type="table-row@3" />
            </div>

            <v-alert
              v-else-if="votersErrorFor(entry)"
              type="error"
              variant="tonal"
              density="compact"
              class="mb-0"
              :text="votersErrorFor(entry)"
            />

            <template v-else-if="votersFor(entry)">
              <p
                v-if="votersFor(entry).length === 0"
                class="text-body-2 text-medium-emphasis text-center py-4 mb-0"
              >
                No voters recorded.
              </p>

              <v-table v-else density="compact" class="voters-table bg-transparent">
                <thead>
                  <tr>
                    <th class="text-left">Voter</th>
                    <th class="text-left">When</th>
                    <th class="text-right">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(voter, index) in votersFor(entry)" :key="`${entry.id}-voter-${index}`">
                    <td class="text-body-2">
                      <UserIdentityChip v-bind="identityFor(voter.voter)" />
                    </td>
                    <td class="text-body-2">{{ formatTimeoutTimestamp(voter.timestamp) }}</td>
                    <td class="text-body-2 text-right font-weight-bold">{{ voter.weight }}</td>
                  </tr>
                </tbody>
              </v-table>
            </template>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <div v-if="totalPages > 1" class="d-flex justify-center mt-6">
        <v-pagination
          :model-value="page"
          :length="totalPages"
          density="compact"
          total-visible="7"
          @update:model-value="$emit('update:page', $event)"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import {
  TIMEOUT_HISTORY_PAGE_SIZE,
  fetchTimeoutVoters,
  formatTimeoutDuration,
  formatTimeoutTimestamp,
} from "../lib/timeoutVotes.js";
import UserIdentityChip from "./UserIdentityChip.vue";

const props = defineProps({
  entries: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  page: { type: Number, default: 1 },
  loading: { type: Boolean, default: false },
  /** chat_member_mapping id -> { name, nickname, handle } (see lib/userIdentity.js). */
  identityMap: { type: Map, default: () => new Map() },
  skeletonCount: { type: Number, default: TIMEOUT_HISTORY_PAGE_SIZE },
});

defineEmits(["update:page"]);

const expandedKey = ref(null);
/** @type {import('vue').Ref<Map<number, Array<object>>>} */
const votersCache = ref(new Map());
/** @type {import('vue').Ref<number|null>} */
const votersLoadingKey = ref(null);
/** @type {import('vue').Ref<Map<number, string>>} */
const votersErrors = ref(new Map());

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / TIMEOUT_HISTORY_PAGE_SIZE)));

watch(expandedKey, (key) => {
  if (key == null) return;
  const entry = props.entries.find((row) => row.id === key);
  if (entry) void loadVoters(entry);
});

/**
 * Resolve UserIdentityChip props for a chat_member_mapping id.
 * @param {number|null|undefined} mappingId
 * @returns {{ mappingId: number|null, name: string|null, nickname: string|null, handle: string|null }}
 */
function identityFor(mappingId) {
  const id = mappingId != null ? Number(mappingId) : null;
  const identity = id != null ? props.identityMap.get(id) : null;
  return {
    mappingId: id,
    name: identity?.name ?? null,
    nickname: identity?.nickname ?? null,
    handle: identity?.handle ?? null,
  };
}

/**
 * @param {{ id: number }} entry
 * @returns {boolean}
 */
function isVotersLoading(entry) {
  return votersLoadingKey.value === entry.id;
}

/**
 * @param {{ id: number }} entry
 * @returns {string|undefined}
 */
function votersErrorFor(entry) {
  return votersErrors.value.get(entry.id);
}

/**
 * @param {{ id: number }} entry
 * @returns {Array<object>|undefined}
 */
function votersFor(entry) {
  return votersCache.value.get(entry.id);
}

/**
 * Fetch voters for one timeout event when its panel is expanded.
 * @param {{ id: number }} entry
 * @returns {Promise<void>}
 */
async function loadVoters(entry) {
  if (votersCache.value.has(entry.id) || votersLoadingKey.value === entry.id) return;

  votersLoadingKey.value = entry.id;
  const nextErrors = new Map(votersErrors.value);
  nextErrors.delete(entry.id);
  votersErrors.value = nextErrors;

  try {
    const voters = await fetchTimeoutVoters(entry.id);
    const nextCache = new Map(votersCache.value);
    nextCache.set(entry.id, voters);
    votersCache.value = nextCache;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load voters";
    const errors = new Map(votersErrors.value);
    errors.set(entry.id, message);
    votersErrors.value = errors;
  } finally {
    if (votersLoadingKey.value === entry.id) {
      votersLoadingKey.value = null;
    }
  }
}
</script>

<style scoped>
.timeout-panels {
  background: transparent;
}

.timeout-panel {
  background: transparent;
}

.timeout-panel-title {
  padding-inline: 0;
  min-height: 3rem;
}

.voters-table :deep(th) {
  font-weight: 600;
  white-space: nowrap;
}

.voters-table :deep(td),
.voters-table :deep(th) {
  border-bottom: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
