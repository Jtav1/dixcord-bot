<template>
  <v-app class="app-shell">
    <div class="app-background-sky" aria-hidden="true" />
    <div class="app-background-landscape" aria-hidden="true" />
    <div class="app-background-scrim" aria-hidden="true" />

    <v-app-bar class="app-bar" sticky flat>
      <v-app-bar-title class="app-bar-title text-h6 font-weight-bold">
        Dixcord Admin
      </v-app-bar-title>

      <v-tabs
        :model-value="activeClientKey"
        class="app-tabs"
        color="primary"
        show-arrows
      >
        <v-tab
          v-for="client in CLIENTS"
          :key="client.key"
          :value="client.key"
          :to="clientHomePath(client)"
          class="text-none"
        >
          {{ client.label }}
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
          :to="`/${activeClientKey}/${feature.key}`"
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
import { computed } from "vue";
import { useRoute } from "vue-router";
import ThemeToggle from "./ThemeToggle.vue";
import GlobalSnackbar from "./GlobalSnackbar.vue";
import { CLIENTS } from "../nav/clients.js";

const route = useRoute();

const activeClientKey = computed(
  () => CLIENTS.find((client) => route.path.startsWith(`/${client.key}`))?.key,
);

const activeFeatures = computed(
  () => CLIENTS.find((client) => client.key === activeClientKey.value)?.features ?? [],
);

/**
 * @param {{ key: string, features: { key: string }[] }} client
 * @returns {string}
 */
function clientHomePath(client) {
  return `/${client.key}/${client.features[0]?.key ?? ""}`;
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
