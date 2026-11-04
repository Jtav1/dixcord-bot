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
        :model-value="selectedScope"
        :items="scopeItems"
        item-title="label"
        item-value="value"
        density="compact"
        variant="outlined"
        hide-details
        class="app-scope-select"
        @update:model-value="onScopeChange"
      />

      <v-spacer />

      <ThemeToggle />
    </v-app-bar>

    <v-navigation-drawer class="app-drawer" permanent width="256">
      <v-list nav density="comfortable">
        <v-list-item
          v-for="feature in activeFeatures"
          :key="feature.key"
          :to="featurePath(feature.key)"
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
import { GLOBAL_FEATURES, BOT_FEATURES, appLabel } from "../nav/clients.js";
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

/** `"global"`, or `"<app>:<guildId>"` for a specific configured bot (guild_info is keyed on (app, guild_id)). */
const selectedScope = computed(() =>
  route.path.startsWith("/bot/") ? `${route.params.app}:${route.params.guildId}` : "global",
);

const scopeItems = computed(() => [
  { value: "global", label: "Global" },
  ...guilds.value.map((guild) => ({
    value: `${guild.app}:${guild.guildId}`,
    label: `${guild.name} (${appLabel(guild.app)})`,
  })),
]);

/** Left-nav features for the active scope: cross-app ones under Global, per-bot ones otherwise. */
const activeFeatures = computed(() => (selectedScope.value === "global" ? GLOBAL_FEATURES : BOT_FEATURES));

/**
 * @param {string} featureKey
 * @returns {string}
 */
function featurePath(featureKey) {
  if (selectedScope.value === "global") return `/global/${featureKey}`;
  const [app, guildId] = selectedScope.value.split(":");
  return `/bot/${app}/${guildId}/${featureKey}`;
}

/**
 * Switch scope: land on the new scope's first feature. Global and per-bot feature sets are
 * disjoint (Config/React For Role only exist per-bot; everything else only exists under
 * Global), so there's no "current feature" to carry across the switch.
 * @param {string} value
 * @returns {void}
 */
function onScopeChange(value) {
  if (value === "global") {
    router.push(`/global/${GLOBAL_FEATURES[0].key}`);
    return;
  }
  const [app, guildId] = value.split(":");
  router.push(`/bot/${app}/${guildId}/${BOT_FEATURES[0].key}`);
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

.app-scope-select {
  flex: 0 1 320px;
  min-width: 0;
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
