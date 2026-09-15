<template>
  <v-menu v-model="menuOpen" location="bottom" :close-on-content-click="false">
    <template #activator="{ props: menuProps }">
      <v-chip v-bind="menuProps" size="small" variant="tonal" class="identity-chip">
        <v-icon start size="14">mdi-account-outline</v-icon>
        {{ mapping ? `#${mapping.id} ${mapping.name}` : `#${platformUserId}` }}
      </v-chip>
    </template>

    <v-card class="glass-card pa-3" min-width="280" max-width="360">
      <template v-if="mapping">
        <div class="identity-row">
          <span class="identity-label">Internal ID</span>
          <span>{{ mapping.id }}</span>
        </div>
        <div class="identity-row mb-2">
          <span class="identity-label">Name</span>
          <span>{{ mapping.name }}</span>
        </div>

        <v-divider class="mb-2" />

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
          No linked guild members.
        </p>
        <div v-else>
          <div v-for="appGroup in groupedAliases" :key="appGroup.app" class="app-group mb-2">
            <div class="app-header text-caption font-weight-bold text-uppercase mb-1">
              {{ appGroup.app }}
            </div>
            <div v-for="guildGroup in appGroup.guilds" :key="guildGroup.guildId" class="guild-group mb-2 ml-2">
              <div class="guild-header text-caption font-weight-medium text-medium-emphasis mb-1">
                {{ guildGroup.guildName }}
              </div>
              <div v-for="alias in guildGroup.aliases" :key="alias.id" class="mb-1">
                <div class="identity-row">
                  <span class="identity-label">Handle</span>
                  <span>{{ alias.handle || "—" }}</span>
                </div>
                <div class="identity-row">
                  <span class="identity-label">Platform User ID</span>
                  <span>{{ alias.platformUserId }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <p v-else class="text-caption text-medium-emphasis mb-0">
        No user mapping found for platform ID {{ platformUserId }}.
      </p>
    </v-card>
  </v-menu>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { fetchAliasesForMapping } from "../lib/guildMembers.js";

const props = defineProps({
  /** Full chat_member_mapping row ({id,name}), or null if unresolved. */
  mapping: { type: Object, default: null },
  /** Fallback identifier (and lookup key) when mapping is null. */
  platformUserId: { type: String, required: true },
});

const menuOpen = ref(false);
const aliases = ref([]);
const aliasesLoading = ref(false);
const aliasesError = ref("");
let loadedForId = null;

/**
 * Every guild_members alias for this identity, grouped by app then guild, each sorted alphabetically.
 * @returns {Array<{ app: string, guilds: Array<{ guildId: string, guildName: string, aliases: Array<object> }> }>}
 */
const groupedAliases = computed(() => {
  const byApp = new Map();
  for (const alias of aliases.value) {
    const appKey = alias.app ?? "unknown";
    if (!byApp.has(appKey)) byApp.set(appKey, new Map());
    const byGuild = byApp.get(appKey);
    const guildKey = alias.guildId ?? "unknown";
    if (!byGuild.has(guildKey)) {
      byGuild.set(guildKey, {
        guildId: alias.guildId,
        guildName: alias.guildName || alias.guildId,
        aliases: [],
      });
    }
    byGuild.get(guildKey).aliases.push(alias);
  }
  return [...byApp.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([app, byGuild]) => ({
      app,
      guilds: [...byGuild.values()].sort((a, b) =>
        (a.guildName ?? "").localeCompare(b.guildName ?? ""),
      ),
    }));
});

/**
 * @returns {Promise<void>}
 */
async function loadAliases() {
  if (!props.mapping?.id || loadedForId === props.mapping.id) return;
  aliasesLoading.value = true;
  aliasesError.value = "";
  try {
    aliases.value = await fetchAliasesForMapping(props.mapping.id);
    loadedForId = props.mapping.id;
  } catch (err) {
    aliasesError.value = err instanceof Error ? err.message : "Failed to load linked apps";
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

.app-header {
  letter-spacing: 0.04em;
}

.guild-group:last-child {
  margin-bottom: 0 !important;
}
</style>
