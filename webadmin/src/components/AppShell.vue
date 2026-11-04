<template>
  <v-app class="app-shell">
    <div class="app-background-sky" aria-hidden="true" />
    <div class="app-background-landscape" aria-hidden="true" />
    <div class="app-background-scrim" aria-hidden="true" />

    <v-app-bar class="app-bar" sticky flat>
      <v-app-bar-title class="app-bar-title text-h6 font-weight-bold">
        Dixcord Admin
      </v-app-bar-title>

      <v-select
        v-if="CLIENTS.length > 1"
        :model-value="activeClientKey"
        :items="clientItems"
        item-title="label"
        item-value="key"
        density="compact"
        variant="outlined"
        hide-details
        class="app-client-select"
        @update:model-value="onClientChange"
      />

      <v-tabs
        :model-value="activeGuildScope"
        class="app-tabs"
        color="primary"
        show-arrows
      >
        <v-tab
          v-for="tab in guildTabs"
          :key="tab.key"
          :value="tab.key"
          :to="guildTabPath(tab.key)"
          class="text-none"
        >
          {{ tab.label }}
        </v-tab>
      </v-tabs>

      <v-spacer />

      <ThemeToggle />
    </v-app-bar>

    <v-navigation-drawer class="app-drawer" permanent width="256">
      <v-list nav density="comfortable">
        <v-list-item
          v-for="feature in activeFeatures"
          :key="feature.key"
          :to="`/${activeClientKey}/${activeGuildScope}/${feature.key}`"
          :prepend-icon="feature.icon"
          :title="feature.label"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main class="app-main">
      <v-container class="py-8">
        <slot />
      </v-container>
    </v-main>

    <GlobalSnackbar />
  </v-app>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import ThemeToggle from "./ThemeToggle.vue";
import GlobalSnackbar from "./GlobalSnackbar.vue";
import { CLIENTS, appForClientKey } from "../nav/clients.js";
import { fetchAllGuilds } from "../lib/guild.js";

const route = useRoute();
const router = useRouter();

/** @type {import("vue").Ref<Array<{app:string,guildId:string,name:string}>>} */
const guilds = ref([]);

onMounted(async () => {
  try {
    guilds.value = await fetchAllGuilds();
  } catch {
    guilds.value = [];
  }
});

const activeClientKey = computed(
  () =>
    CLIENTS.find((client) => route.path.startsWith(`/${client.key}`))?.key ?? CLIENTS[0].key,
);

/** The chat-app value (`"discord"`/`"fluxer"`) the active client's features should query webapi with. */
const activeApp = computed(() => appForClientKey(activeClientKey.value));

const clientItems = computed(() => CLIENTS.map((client) => ({ key: client.key, label: client.label })));

/**
 * Switch clients: land on the new client's first feature under "Global" — a guild tab selected
 * under the old client's app has no meaning for the new one, so never carry it across.
 * @param {string} clientKey
 * @returns {void}
 */
function onClientChange(clientKey) {
  const client = CLIENTS.find((c) => c.key === clientKey);
  if (!client) return;
  router.push(`/${clientKey}/global/${client.features[0].key}`);
}

const activeGuildScope = computed(() => route.params.guildScope ?? "global");

/** Current feature key, read from the URL's last path segment. */
const activeFeatureKey = computed(() => route.path.split("/").filter(Boolean).pop());

const allFeatures = computed(
  () => CLIENTS.find((client) => client.key === activeClientKey.value)?.features ?? [],
);

/** Left-nav features, dropping guild-scoped ones (e.g. Config) while "Global" is active. */
const activeFeatures = computed(() =>
  activeGuildScope.value === "global"
    ? allFeatures.value.filter((feature) => !feature.guildScoped)
    : allFeatures.value,
);

/**
 * Guild-tab list: a hardcoded "Global" entry first, then one tab per synced guild belonging to
 * the active client's app — never another app's guild, so a tab always loads its own bot's data.
 */
const guildTabs = computed(() => [
  { key: "global", label: "Global" },
  ...guilds.value
    .filter((guild) => guild.app === activeApp.value)
    .map((guild) => ({ key: guild.guildId, label: guild.name })),
]);

/**
 * Target path for a guild tab: stay on the current feature, unless it's guild-scoped and the
 * target is "Global" (that feature is hidden there), in which case fall back to dashboard.
 * @param {string} guildScope
 * @returns {string}
 */
function guildTabPath(guildScope) {
  const currentFeature = allFeatures.value.find((f) => f.key === activeFeatureKey.value);
  const feature =
    guildScope === "global" && currentFeature?.guildScoped
      ? "dashboard"
      : (activeFeatureKey.value ?? "dashboard");
  return `/${activeClientKey.value}/${guildScope}/${feature}`;
}
</script>

<style scoped>
.app-bar {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(var(--v-theme-surface), 0.75) !important;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.app-bar-title {
  flex: 0 0 auto;
  min-width: fit-content;
  margin-right: 1rem;
}

.app-tabs {
  flex: 1 1 auto;
  min-width: 0;
}

.app-client-select {
  flex: 0 0 auto;
  width: 180px;
  margin-right: 1rem;
}

.app-drawer {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(var(--v-theme-surface), 0.75) !important;
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.app-main {
  position: relative;
  z-index: 2;
}
</style>
