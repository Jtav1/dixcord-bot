<template>
  <div>
    <v-alert v-if="error" type="error" variant="tonal" class="mb-4" :text="error" />

    <v-skeleton-loader v-if="loading" type="table-heading, list-item-two-line@4" />

    <template v-else>
      <v-table class="glass-card">
        <thead>
          <tr>
            <th v-if="$slots.expanded" style="width: 40px" />
            <th v-for="header in headers" :key="header.key">{{ header.title }}</th>
            <th v-if="$slots.actions" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!items.length">
            <td :colspan="colspan" class="text-medium-emphasis">
              {{ emptyText }}
            </td>
          </tr>
          <template v-for="item in items" :key="item[itemKey]">
            <tr>
              <td v-if="$slots.expanded" style="cursor: pointer" @click="toggleExpanded(item[itemKey])">
                <v-icon :icon="isExpanded(item[itemKey]) ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="20" />
              </td>
              <td v-for="header in headers" :key="header.key">
                <slot :name="`cell-${header.key}`" :item="item">
                  {{ item[header.key] }}
                </slot>
              </td>
              <td v-if="$slots.actions" class="text-right">
                <slot name="actions" :item="item" />
              </td>
            </tr>
            <tr v-if="$slots.expanded && isExpanded(item[itemKey])">
              <td :colspan="colspan" class="pa-0">
                <slot name="expanded" :item="item" />
              </td>
            </tr>
          </template>
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
import { computed, ref, useSlots } from "vue";

const props = defineProps({
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

const slots = useSlots();

const colspan = computed(
  () => props.headers.length + (slots.actions ? 1 : 0) + (slots.expanded ? 1 : 0),
);

const expandedKeys = ref(new Set());

/**
 * @param {unknown} key
 * @returns {boolean}
 */
function isExpanded(key) {
  return expandedKeys.value.has(key);
}

/**
 * @param {unknown} key
 * @returns {void}
 */
function toggleExpanded(key) {
  const next = new Set(expandedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedKeys.value = next;
}
</script>
