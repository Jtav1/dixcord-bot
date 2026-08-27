<template>
  <div>
    <v-text-field
      v-model="search"
      label="Search users"
      placeholder="Name or handle"
      prepend-inner-icon="mdi-magnify"
      density="comfortable"
      variant="outlined"
      clearable
      hide-details
      class="mb-4"
    />

    <template v-if="loading">
      <v-skeleton-loader type="table-heading" class="mb-4" />
      <v-skeleton-loader
        v-for="n in skeletonCount"
        :key="`user-skeleton-${n}`"
        type="list-item-two-line"
        class="mb-2"
      />
    </template>

    <p
      v-else-if="filteredUsers.length === 0"
      class="text-body-2 text-medium-emphasis text-center py-8"
    >
      {{ users.length === 0 ? "No users found." : "No users match your search." }}
    </p>

    <v-table
      v-else
      density="comfortable"
      class="trigger-history-users-table bg-transparent"
    >
      <thead>
        <tr>
          <th class="text-left">Name</th>
          <th class="text-left">Handle</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="user in filteredUsers"
          :key="user.id"
          class="clickable-row"
          role="button"
          tabindex="0"
          @click="$emit('select-user', user.id)"
          @keydown.enter="$emit('select-user', user.id)"
        >
          <td class="text-body-2">{{ user.name }}</td>
          <td class="text-body-2 text-medium-emphasis">{{ user.handle }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  users: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  skeletonCount: {
    type: Number,
    default: 8,
  },
});

defineEmits(["select-user"]);

const search = ref("");

/**
 * Users filtered by the search box, matching name or handle case-insensitively.
 * @returns {Array<{ id: number, name: string, handle: string }>}
 */
const filteredUsers = computed(() => {
  const term = search.value?.trim().toLowerCase();
  if (!term) return props.users;
  return props.users.filter((user) => {
    const name = String(user.name ?? "").toLowerCase();
    const handle = String(user.handle ?? "").toLowerCase();
    return name.includes(term) || handle.includes(term);
  });
});
</script>

<style scoped>
.trigger-history-users-table :deep(th) {
  font-weight: 700;
}

.clickable-row {
  cursor: pointer;
}

.clickable-row:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.clickable-row:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
</style>
