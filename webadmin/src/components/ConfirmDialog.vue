<template>
  <v-dialog v-model="internalOpen" max-width="480" persistent>
    <v-card class="glass-card">
      <v-card-title class="text-h6">{{ title }}</v-card-title>
      <v-card-text class="text-body-1 text-medium-emphasis">{{ message }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="loading" @click="emit('cancel')">Cancel</v-btn>
        <v-btn color="error" variant="flat" :loading="loading" @click="emit('confirm')">
          {{ confirmLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: "Confirm" },
  message: { type: String, default: "Are you sure? This cannot be undone." },
  confirmLabel: { type: String, default: "Delete" },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue", "confirm", "cancel"]);

const internalOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});
</script>
