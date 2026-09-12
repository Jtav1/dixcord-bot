<template>
  <div class="view-page view-page--narrow">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">{{ title }}</h1>
      <p class="text-body-1 text-medium-emphasis">This section hasn't been built yet.</p>
    </header>

    <v-card class="glass-card pa-6">
      <v-card-text class="pa-0 text-body-1 text-medium-emphasis">
        Coming soon.
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
});
</script>
