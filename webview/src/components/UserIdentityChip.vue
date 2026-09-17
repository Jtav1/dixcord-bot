<template>
  <v-menu v-model="menuOpen" location="bottom" :close-on-content-click="false">
    <template #activator="{ props: menuProps }">
      <v-chip
        v-bind="menuProps"
        size="small"
        variant="tonal"
        class="identity-chip"
        @click.stop
      >
        <v-icon start size="14">mdi-account-outline</v-icon>
        {{ collapsedLabel }}
      </v-chip>
    </template>

    <v-card class="glass-card pa-3" min-width="240" max-width="320" @click.stop>
      <template v-if="mappingId != null">
        <v-skeleton-loader v-if="aliasesLoading" type="list-item-two-line@2" />
        <v-alert
          v-else-if="aliasesError"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-0"
          :text="aliasesError"
        />
        <p v-else-if="!groupedAliases.length" class="text-caption text-medium-emphasis mb-0">
          No linked servers found.
        </p>
        <div v-else>
          <div v-for="guild in groupedAliases" :key="guild.guildId" class="guild-group mb-2">
            <div class="guild-header text-caption font-weight-medium text-medium-emphasis mb-1">
              {{ guild.guildName }}
            </div>
            <div class="identity-row">
              <span class="identity-label">Handle</span>
              <span>{{ guild.handle || "—" }}</span>
            </div>
            <div class="identity-row">
              <span class="identity-label">Nickname</span>
              <span>{{ guild.nickname || "—" }}</span>
            </div>
          </div>
        </div>
      </template>
      <p v-else class="text-caption text-medium-emphasis mb-0">
        No linked server identity.
      </p>
    </v-card>
  </v-menu>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { fetchAliasesForMapping } from "../lib/userIdentity.js";

const props = defineProps({
  /** chat_member_mapping id, or null if this platform user has no linked identity. */
  mappingId: { type: Number, default: null },
  /** chat_member_mapping.name — the default collapsed label. */
  name: { type: String, default: null },
  /** Discord nickname (guild_members.nickname), shown collapsed only when name is unknown. */
  nickname: { type: String, default: null },
  /** Discord handle, shown collapsed only when name and nickname are unknown. */
  handle: { type: String, default: null },
  /** Last-resort collapsed label (e.g. the raw platform snowflake). */
  platformUserId: { type: String, default: null },
});

const menuOpen = ref(false);
const aliases = ref([]);
const aliasesLoading = ref(false);
const aliasesError = ref("");
let loadedForId = null;

/** @returns {string} */
const collapsedLabel = computed(
  () => props.name || props.nickname || props.handle || props.platformUserId || "Unknown",
);

/**
 * Per-guild handle/nickname, sorted alphabetically by guild name.
 * @returns {Array<{ guildId: string, guildName: string, handle: string|null, nickname: string|null }>}
 */
const groupedAliases = computed(() =>
  [...aliases.value].sort((a, b) => (a.guildName ?? "").localeCompare(b.guildName ?? "")),
);

/**
 * @returns {Promise<void>}
 */
async function loadAliases() {
  if (props.mappingId == null || loadedForId === props.mappingId) return;
  aliasesLoading.value = true;
  aliasesError.value = "";
  try {
    aliases.value = await fetchAliasesForMapping(props.mappingId);
    loadedForId = props.mappingId;
  } catch (err) {
    aliasesError.value = err instanceof Error ? err.message : "Failed to load linked servers";
  } finally {
    aliasesLoading.value = false;
  }
}

watch(menuOpen, (open) => {
  if (open) void loadAliases();
});
</script>

<style scoped>
.identity-chip {
  cursor: pointer;
}

.identity-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 2px 0;
  font-size: 0.8rem;
}

.identity-label {
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.guild-group:last-child {
  margin-bottom: 0 !important;
}
</style>
