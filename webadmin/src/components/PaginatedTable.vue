<template>
  <div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" :text="error" />

    <v-skeleton-loader v-if="loading" type="table-heading, list-item-two-line@4" />

    <template v-else>
      <v-table class="glass-card">
        <thead>
          <tr>
            <th v-for="header in headers" :key="header.key">{{ header.title }}</th>
            <th v-if="$slots.actions" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!items.length">
            <td :colspan="headers.length + ($slots.actions ? 1 : 0)" class="text-medium-emphasis">
              {{ emptyText }}
            </td>
          </tr>
          <tr v-for="item in items" :key="item[itemKey]">
            <td v-for="header in headers" :key="header.key">
              <slot :name="`cell-${header.key}`" :item="item">
                {{ item[header.key] }}
              </slot>
            </td>
            <td v-if="$slots.actions" class="text-right">
              <slot name="actions" :item="item" />
            </td>
          </tr>
        </tbody>
      </v-table>

      <div v-if="totalPages > 1" class="d-flex justify-center mt-4">
        <v-pagination
          :model-value="page"
          :length="totalPages"
          density="compact"
          total-visible="7"
          @update:model-value="(val) => emit('update:page', val)"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
defineProps({
  headers: { type: Array, required: true },
  items: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  page: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 },
  itemKey: { type: String, default: "id" },
  emptyText: { type: String, default: "No entries." },
});

const emit = defineEmits(["update:page"]);
</script>
