<template>
  <v-menu location="bottom" :close-on-content-click="false">
    <template #activator="{ props: menuProps }">
      <v-chip v-bind="menuProps" size="small" variant="tonal" class="identity-chip">
        <v-icon start size="14">mdi-account-outline</v-icon>
        {{ mapping ? `#${mapping.id} ${mapping.name}` : `#${platformUserId}` }}
      </v-chip>
    </template>

    <v-card class="glass-card pa-3" min-width="260">
      <template v-if="mapping">
        <div class="identity-row">
          <span class="identity-label">Internal ID</span>
          <span>{{ mapping.id }}</span>
        </div>
        <div class="identity-row">
          <span class="identity-label">Name</span>
          <span>{{ mapping.name }}</span>
        </div>
        <div class="identity-row">
          <span class="identity-label">Handle</span>
          <span>{{ mapping.handle }}</span>
        </div>
        <div class="identity-row">
          <span class="identity-label">Platform User ID</span>
          <span>{{ mapping.platformUserId }}</span>
        </div>
        <div class="identity-row">
          <span class="identity-label">App</span>
          <span>{{ mapping.app }}</span>
        </div>
      </template>
      <p v-else class="text-caption text-medium-emphasis mb-0">
        No user mapping found for platform ID {{ platformUserId }}.
      </p>
    </v-card>
  </v-menu>
</template>

<script setup>
defineProps({
  /** Full chat_member_mapping row ({id,name,handle,platformUserId,app}), or null if unresolved. */
  mapping: { type: Object, default: null },
  /** Fallback identifier (and lookup key) when mapping is null. */
  platformUserId: { type: String, required: true },
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
</style>
