<template>
  <div class="view-page">
    <header class="view-header mb-6 d-flex align-center justify-space-between flex-wrap ga-4">
      <div>
        <h1 class="text-h4 font-weight-bold mb-2">Config &amp; Feature Flags</h1>
        <p class="text-body-1 text-medium-emphasis">
          Bot settings, feature toggles, and cache control
        </p>
      </div>
      <v-btn
        color="secondary"
        variant="tonal"
        prepend-icon="mdi-cached"
        :loading="invalidating"
        @click="onInvalidateCache"
      >
        Invalidate Bot Cache
      </v-btn>
    </header>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-6" :text="error" />

    <v-skeleton-loader v-if="loading" type="card@2" class="mb-6" />

    <ConfigSettingsForm
      v-else-if="currentApp && currentGuildId"
      :app="currentApp"
      :guild-id="currentGuildId"
      :entries="entries"
      :channels="channels"
      :roles="roles"
      class="mb-6"
    />

    <v-card class="glass-card pa-6">
      <v-card-title class="text-h6 pa-0 mb-4">Try It</v-card-title>
      <v-card-text class="pa-0">
        <div class="d-flex align-center ga-4 flex-wrap mb-4">
          <v-btn size="small" variant="tonal" :loading="fortuneLoading" @click="onTryFortune">
            Test 8-Ball Fortune
          </v-btn>
          <span v-if="fortuneResult" class="text-body-2">{{ fortuneResult }}</span>
        </div>

        <div class="d-flex align-center ga-4 flex-wrap">
          <v-text-field
            v-model="linkFixerInput"
            label="Message to test"
            density="comfortable"
            variant="outlined"
            hide-details
            style="max-width: 360px"
          />
          <v-btn size="small" variant="tonal" :loading="linkFixerLoading" @click="onTryLinkFixer">
            Test Link Fixer
          </v-btn>
          <span v-if="linkFixerChecked" class="text-body-2">
            {{ linkFixerResult || "(no fix applied)" }}
          </span>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import ConfigSettingsForm from "../components/ConfigSettingsForm.vue";
import { fetchConfigEntries } from "../lib/config.js";
import { fetchGuildSnapshot } from "../lib/guild.js";
import { invalidateConfigCache } from "../lib/systemStatus.js";
import { testFortune, testLinkFixer } from "../lib/botResponses.js";
import { useSnackbar } from "../composables/useSnackbar.js";

const { notify } = useSnackbar();

const loading = ref(true);
const error = ref("");
/** @type {import("vue").Ref<Array<{config:string,value:string,description:string|null,type:string,requiresBotRestart:boolean,deprecated:boolean}>>} */
const entries = ref([]);

/** @type {import("vue").Ref<string|null>} */
const currentApp = ref(null);
/** @type {import("vue").Ref<string|null>} */
const currentGuildId = ref(null);
/** @type {import("vue").Ref<Array<{id:string,name:string}>>} */
const channels = ref([]);
/** @type {import("vue").Ref<Array<{id:string,name:string}>>} */
const roles = ref([]);

const invalidating = ref(false);
const fortuneLoading = ref(false);
const fortuneResult = ref("");
const linkFixerInput = ref("");
const linkFixerLoading = ref(false);
const linkFixerChecked = ref(false);
const linkFixerResult = ref("");

/**
 * Config is per-(app, guildId), so resolve the synced guild first, then load its config.
 * @returns {Promise<void>}
 */
async function loadConfig() {
  loading.value = true;
  error.value = "";
  try {
    const snapshot = await fetchGuildSnapshot();
    currentApp.value = snapshot.guild.app;
    currentGuildId.value = snapshot.guild.guildId;
    channels.value = snapshot.channels;
    roles.value = snapshot.roles;
    entries.value = await fetchConfigEntries(currentApp.value, currentGuildId.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load config";
  } finally {
    loading.value = false;
  }
}

/**
 * @returns {Promise<void>}
 */
async function onInvalidateCache() {
  invalidating.value = true;
  try {
    await invalidateConfigCache();
    notify("Bot cache invalidated");
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to invalidate cache", {
      color: "error",
    });
  } finally {
    invalidating.value = false;
  }
}

/**
 * @returns {Promise<void>}
 */
async function onTryFortune() {
  fortuneLoading.value = true;
  try {
    fortuneResult.value = await testFortune();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to get fortune", {
      color: "error",
    });
  } finally {
    fortuneLoading.value = false;
  }
}

/**
 * @returns {Promise<void>}
 */
async function onTryLinkFixer() {
  linkFixerLoading.value = true;
  linkFixerChecked.value = false;
  try {
    linkFixerResult.value = await testLinkFixer(linkFixerInput.value);
    linkFixerChecked.value = true;
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to test link fixer", {
      color: "error",
    });
  } finally {
    linkFixerLoading.value = false;
  }
}

onMounted(() => {
  void loadConfig();
});
</script>
