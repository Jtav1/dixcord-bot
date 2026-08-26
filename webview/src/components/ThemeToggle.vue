<template>
  <v-btn
    :icon="icon"
    variant="text"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="toggleTheme"
  />
</template>

<script setup>
import { computed } from "vue";
import { useThemePreference } from "../composables/useThemePreference.js";

const { isDark, toggleTheme } = useThemePreference();

const icon = computed(() =>
  isDark.value ? "mdi-weather-sunny" : "mdi-weather-night",
);
</script>
