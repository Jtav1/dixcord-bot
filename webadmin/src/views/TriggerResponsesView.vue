<template>
  <div class="view-page view-page--wide">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Trigger Responses</h1>
      <p class="text-body-1 text-medium-emphasis">
        Auto-reply triggers, their responses, and usage history
      </p>
    </header>

    <v-tabs v-model="tab" color="primary" class="mb-6">
      <v-tab value="triggers">Triggers</v-tab>
      <v-tab value="history">History</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="triggers">
        <TriggerResponseEditor />
      </v-window-item>
      <v-window-item value="history">
        <TriggerHistoryPanel />
      </v-window-item>
    </v-window>
  </div>
</template>

<script setup>
import { ref } from "vue";
import TriggerResponseEditor from "../components/TriggerResponseEditor.vue";
import TriggerHistoryPanel from "../components/TriggerHistoryPanel.vue";

const tab = ref("triggers");
</script>
