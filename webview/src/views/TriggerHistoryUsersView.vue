<template>
  <div class="view-page">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Trigger History</h1>
      <p class="text-body-1 text-medium-emphasis">
        Pick a user to see their trigger-response history
      </p>
    </header>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-6"
      :text="error"
    />

    <v-card class="glass-card pa-6">
      <v-card-text class="pa-0">
        <TriggerHistoryUsersList
          :users="users"
          :loading="loading"
          @select-user="onSelectUser"
        />
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import TriggerHistoryUsersList from "../components/TriggerHistoryUsersList.vue";
import { fetchAllUserMappings } from "../lib/plusplusRankings.js";

const router = useRouter();

const loading = ref(true);
const error = ref("");
const users = ref([]);

/**
 * Navigate to the selected user's trigger-response history page.
 * @param {number} userId chat_member_mapping.id.
 * @returns {void}
 */
function onSelectUser(userId) {
  router.push(`/trigger-history/${userId}`);
}

onMounted(async () => {
  try {
    users.value = await fetchAllUserMappings("discord");
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Failed to load users";
  } finally {
    loading.value = false;
  }
});
</script>
