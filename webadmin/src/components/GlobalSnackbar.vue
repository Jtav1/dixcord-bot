<template>
  <v-snackbar v-model="visible" :color="color" location="bottom right" :timeout="4000">
    {{ message }}
  </v-snackbar>
</template>

<script setup>
import { useSnackbar } from "../composables/useSnackbar.js";

const { message, color, visible } = useSnackbar();
</script>
