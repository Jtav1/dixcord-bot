<template>
  <AppShell>
    <router-view :key="route.fullPath" />
  </AppShell>
</template>

<script setup>
import { useRoute } from "vue-router";
import AppShell from "./components/AppShell.vue";

const route = useRoute();
</script>
