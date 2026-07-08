<template>
  <v-app class="app-shell">
    <div class="app-background-sky" aria-hidden="true" />
    <div class="app-background-landscape" aria-hidden="true" />
    <div class="app-background-scrim" aria-hidden="true" />

    <v-app-bar class="app-bar" sticky flat>
      <v-app-bar-title class="app-bar-title text-h6 font-weight-bold">
        Dixcord View
      </v-app-bar-title>

      <v-tabs
        :model-value="activeTab"
        class="app-tabs"
        color="primary"
        show-arrows
      >
        <v-tab
          v-for="tab in tabs"
          :key="tab.route"
          :value="tab.route"
          :to="tab.route"
          class="text-none"
        >
          {{ tab.label }}
        </v-tab>
      </v-tabs>

      <v-spacer />

      <ThemeToggle />
    </v-app-bar>

    <v-main class="app-main">
      <v-container class="py-8">
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import ThemeToggle from "./ThemeToggle.vue";

/** @type {{ label: string, route: string }[]} */
const tabs = [
  { label: "System Status", route: "/system-status" },
  { label: "Pin Archive", route: "/pin-archive" },
  { label: "Emoji Count", route: "/emoji-count" },
  { label: "Sticker Count", route: "/sticker-count" },
  { label: "PlusPlus Rankings", route: "/plusplus-rankings" },
  { label: "Statistics", route: "/statistics" },
];

const route = useRoute();

const activeTab = computed(() => route.path);
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

.app-main {
  position: relative;
  z-index: 2;
}
</style>
