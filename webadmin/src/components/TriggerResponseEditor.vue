<template>
  <div>
    <v-alert v-if="listError" type="error" variant="tonal" class="mb-4" :text="listError" />

    <v-row>
      <v-col cols="12" md="4">
        <v-card class="glass-card pa-4">
          <v-text-field
            v-model="search"
            placeholder="Search triggers"
            density="compact"
            variant="outlined"
            hide-details
            prepend-inner-icon="mdi-magnify"
            class="mb-3"
          />
          <v-btn block color="primary" variant="tonal" class="mb-3" @click="openCreateDialog">
            New Trigger
          </v-btn>
          <v-skeleton-loader v-if="listLoading" type="list-item@6" />
          <v-list v-else nav density="comfortable">
            <v-list-item
              v-for="trigger in filteredTriggers"
              :key="trigger.id"
              :active="selectedId === trigger.id"
              :title="trigger.trigger_string"
              :subtitle="trigger.selection_mode"
              @click="selectTrigger(trigger.id)"
            />
            <v-list-item v-if="!filteredTriggers.length" title="No triggers match." />
          </v-list>
        </v-card>
      </v-col>

      <v-col cols="12" md="8">
        <v-alert v-if="detailError" type="error" variant="tonal" class="mb-4" :text="detailError" />
        <v-skeleton-loader v-if="detailLoading" type="card" />

        <v-card v-else-if="detail" class="glass-card pa-6">
          <div class="d-flex align-center justify-space-between flex-wrap ga-4 mb-4">
            <h2 class="text-h6">{{ detail.trigger_string }}</h2>
            <div class="d-flex align-center ga-4">
              <v-select
                :model-value="detail.selection_mode"
                :items="SELECTION_MODES"
                label="Selection mode"
                density="compact"
                variant="outlined"
                hide-details
                style="min-width: 160px"
                @update:model-value="onSelectionModeChange"
              />
              <v-btn color="error" variant="tonal" size="small" @click="confirmDeleteTrigger">
                Delete Trigger
              </v-btn>
            </div>
          </div>

          <v-divider class="mb-4" />

          <div
            v-for="response in detail.responses"
            :key="response.linkId"
            class="response-row mb-4 pb-4"
          >
            <v-textarea
              v-model="responseDrafts[response.linkId].response_string"
              label="Response text"
              hint="Editing this updates it everywhere this response is used"
              persistent-hint
              rows="2"
              auto-grow
              density="comfortable"
              variant="outlined"
              class="mb-2"
            />
            <div class="d-flex align-center flex-wrap ga-3">
              <v-text-field
                v-if="detail.selection_mode === 'ordered'"
                v-model.number="responseDrafts[response.linkId].order"
                label="Order"
                type="number"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 100px"
              />
              <v-text-field
                v-if="detail.selection_mode === 'weighted'"
                v-model.number="responseDrafts[response.linkId].weight"
                label="Weight"
                type="number"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 100px"
              />
              <v-select
                v-model="responseDrafts[response.linkId].response_function"
                :items="functionItems"
                label="Function"
                clearable
                density="compact"
                variant="outlined"
                hide-details
                style="min-width: 200px"
              />
              <v-btn size="small" variant="text" @click="openParametersDialog(response)">
                Parameters{{ response.response_function_parameters ? " •" : "" }}
              </v-btn>
              <v-spacer />
              <v-btn
                size="small"
                color="primary"
                variant="tonal"
                :loading="savingLinkId === response.linkId"
                @click="saveResponse(response)"
              >
                Save
              </v-btn>
              <v-btn size="small" variant="text" @click="confirmRemoveLink(response)">Unlink</v-btn>
              <v-btn size="small" variant="text" color="error" @click="confirmDeleteResponse(response)">
                Delete
              </v-btn>
            </div>
          </div>

          <v-divider class="mb-4" />

          <div class="d-flex align-center flex-wrap ga-3">
            <v-text-field
              v-model="newResponseText"
              label="New response text"
              density="comfortable"
              variant="outlined"
              hide-details
              class="flex-grow-1"
            />
            <v-btn color="primary" variant="tonal" :loading="addingResponse" @click="onAddResponse">
              Add Response
            </v-btn>
          </div>
        </v-card>

        <v-card v-else class="glass-card pa-6 text-medium-emphasis">
          Select a trigger to view and edit its responses.
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="createDialogOpen" max-width="480">
      <v-card class="glass-card">
        <v-card-title class="text-h6">New Trigger</v-card-title>
        <v-card-text>
          <v-text-field v-model="createForm.trigger_string" label="Trigger text" class="mb-3" />
          <v-select
            v-model="createForm.selection_mode"
            :items="SELECTION_MODES"
            label="Selection mode"
            class="mb-3"
          />
          <v-text-field v-model="createForm.response_string" label="First response text" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="createDialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="creating" @click="onCreateTrigger">
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="parametersDialogOpen" max-width="480">
      <v-card class="glass-card">
        <v-card-title class="text-h6">Function Parameters</v-card-title>
        <v-card-text>
          <v-textarea
            v-model="parametersDraft"
            label="JSON object (blank to clear)"
            rows="6"
            :error-messages="parametersError"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="parametersDialogOpen = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" :loading="savingParameters" @click="onSaveParameters">
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ConfirmDialog
      v-model="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :loading="confirmState.loading"
      @confirm="confirmState.onConfirm"
      @cancel="confirmState.open = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import { useSnackbar } from "../composables/useSnackbar.js";
import {
  addTriggerResponse,
  createTrigger,
  deleteResponse as deleteResponseApi,
  deleteTrigger as deleteTriggerApi,
  fetchTriggerDetail,
  fetchTriggerFunctions,
  fetchTriggersList,
  removeTriggerResponseLink,
  updateLinkParameters,
  updateResponseText,
  updateTriggerResponseLinkFields,
  updateTriggerSelectionMode,
} from "../lib/triggerResponses.js";

const SELECTION_MODES = ["random", "ordered", "weighted"];

const { notify } = useSnackbar();

const listLoading = ref(true);
const listError = ref("");
/** @type {import("vue").Ref<Array<{id:number,trigger_string:string,selection_mode:string}>>} */
const triggers = ref([]);
const search = ref("");

const selectedId = ref(null);
const detailLoading = ref(false);
const detailError = ref("");
/** @type {import("vue").Ref<object|null>} */
const detail = ref(null);
/** @type {Record<number, { response_string: string, order: number|null, weight: number|null, response_function: string|null }>} */
const responseDrafts = reactive({});
const savingLinkId = ref(null);
const newResponseText = ref("");
const addingResponse = ref(false);

/** @type {import("vue").Ref<Array<{id:number,function_name:string,display_name:string|null}>>} */
const functions = ref([]);
const functionItems = computed(() =>
  functions.value.map((fn) => ({ title: fn.display_name || fn.function_name, value: fn.function_name })),
);

const createDialogOpen = ref(false);
const creating = ref(false);
const createForm = reactive({ trigger_string: "", selection_mode: "random", response_string: "" });

const parametersDialogOpen = ref(false);
const parametersTargetLinkId = ref(null);
const parametersDraft = ref("");
const parametersError = ref("");
const savingParameters = ref(false);

const confirmState = reactive({
  open: false,
  title: "",
  message: "",
  loading: false,
  onConfirm: async () => {},
});

const filteredTriggers = computed(() => {
  const term = search.value.trim().toLowerCase();
  if (!term) return triggers.value;
  return triggers.value.filter((t) => t.trigger_string.toLowerCase().includes(term));
});

/**
 * @param {{ title: string, message: string, run: () => Promise<void> }} options
 * @returns {void}
 */
function askConfirm({ title, message, run }) {
  confirmState.title = title;
  confirmState.message = message;
  confirmState.onConfirm = async () => {
    confirmState.loading = true;
    try {
      await run();
      confirmState.open = false;
    } catch (err) {
      notify(err instanceof Error ? err.message : "Action failed", { color: "error" });
    } finally {
      confirmState.loading = false;
    }
  };
  confirmState.open = true;
}

/**
 * @returns {Promise<void>}
 */
async function loadTriggers() {
  listLoading.value = true;
  listError.value = "";
  try {
    triggers.value = await fetchTriggersList();
  } catch (err) {
    listError.value = err instanceof Error ? err.message : "Failed to load triggers";
  } finally {
    listLoading.value = false;
  }
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
async function selectTrigger(id) {
  selectedId.value = id;
  detailLoading.value = true;
  detailError.value = "";
  try {
    const data = await fetchTriggerDetail(id);
    detail.value = data;
    seedDrafts(data);
  } catch (err) {
    detailError.value = err instanceof Error ? err.message : "Failed to load trigger";
  } finally {
    detailLoading.value = false;
  }
}

/**
 * @param {object} data
 * @returns {void}
 */
function seedDrafts(data) {
  for (const key of Object.keys(responseDrafts)) delete responseDrafts[key];
  for (const response of data.responses) {
    responseDrafts[response.linkId] = {
      response_string: response.response_string,
      order: response.order,
      weight: response.weight,
      response_function: response.response_function,
    };
  }
}

/**
 * @returns {Promise<void>}
 */
async function reloadDetail() {
  if (selectedId.value != null) await selectTrigger(selectedId.value);
}

/**
 * @param {string} mode
 * @returns {Promise<void>}
 */
async function onSelectionModeChange(mode) {
  if (!detail.value) return;
  try {
    await updateTriggerSelectionMode(detail.value.id, mode);
    notify("Selection mode updated");
    await reloadDetail();
    const row = triggers.value.find((t) => t.id === detail.value.id);
    if (row) row.selection_mode = mode;
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to update selection mode", {
      color: "error",
    });
  }
}

/**
 * @param {{ id: number, linkId: number, response_string: string }} response
 * @returns {Promise<void>}
 */
async function saveResponse(response) {
  const draft = responseDrafts[response.linkId];
  savingLinkId.value = response.linkId;
  try {
    if (draft.response_string !== response.response_string) {
      await updateResponseText(response.id, draft.response_string);
    }
    await updateTriggerResponseLinkFields(detail.value.id, response.linkId, {
      order: draft.order === "" ? null : draft.order,
      weight: draft.weight === "" ? null : draft.weight,
      response_function: draft.response_function || null,
    });
    notify("Response saved");
    await reloadDetail();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to save response", { color: "error" });
  } finally {
    savingLinkId.value = null;
  }
}

/**
 * @returns {Promise<void>}
 */
async function onAddResponse() {
  if (!detail.value || !newResponseText.value.trim()) return;
  addingResponse.value = true;
  try {
    await addTriggerResponse(detail.value.id, { response_string: newResponseText.value.trim() });
    newResponseText.value = "";
    notify("Response added");
    await reloadDetail();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to add response", { color: "error" });
  } finally {
    addingResponse.value = false;
  }
}

/**
 * @param {{ linkId: number }} response
 * @returns {void}
 */
function confirmRemoveLink(response) {
  askConfirm({
    title: "Unlink Response",
    message: "Remove this response from the trigger? The response text itself is kept for other triggers.",
    run: async () => {
      await removeTriggerResponseLink(response.linkId);
      notify("Response unlinked");
      await reloadDetail();
    },
  });
}

/**
 * @param {{ id: number }} response
 * @returns {void}
 */
function confirmDeleteResponse(response) {
  askConfirm({
    title: "Delete Response",
    message: "Delete this response entirely? It will be removed from every trigger that uses it.",
    run: async () => {
      await deleteResponseApi(response.id);
      notify("Response deleted");
      await reloadDetail();
    },
  });
}

/**
 * @returns {void}
 */
function confirmDeleteTrigger() {
  if (!detail.value) return;
  const id = detail.value.id;
  askConfirm({
    title: "Delete Trigger",
    message: `Delete trigger "${detail.value.trigger_string}"? This also removes any of its responses not used elsewhere.`,
    run: async () => {
      await deleteTriggerApi(id);
      notify("Trigger deleted");
      selectedId.value = null;
      detail.value = null;
      await loadTriggers();
    },
  });
}

/**
 * @returns {void}
 */
function openCreateDialog() {
  createForm.trigger_string = "";
  createForm.selection_mode = "random";
  createForm.response_string = "";
  createDialogOpen.value = true;
}

/**
 * @returns {Promise<void>}
 */
async function onCreateTrigger() {
  if (!createForm.trigger_string.trim() || !createForm.response_string.trim()) {
    notify("Trigger text and first response text are required", { color: "error" });
    return;
  }
  creating.value = true;
  try {
    const created = await createTrigger({
      trigger_string: createForm.trigger_string.trim(),
      selection_mode: createForm.selection_mode,
      responses: [{ response_string: createForm.response_string.trim() }],
    });
    notify("Trigger created");
    createDialogOpen.value = false;
    await loadTriggers();
    await selectTrigger(created.id);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to create trigger", { color: "error" });
  } finally {
    creating.value = false;
  }
}

/**
 * @param {{ linkId: number, response_function_parameters: object|null }} response
 * @returns {void}
 */
function openParametersDialog(response) {
  parametersTargetLinkId.value = response.linkId;
  parametersDraft.value = response.response_function_parameters
    ? JSON.stringify(response.response_function_parameters, null, 2)
    : "";
  parametersError.value = "";
  parametersDialogOpen.value = true;
}

/**
 * @returns {Promise<void>}
 */
async function onSaveParameters() {
  let parsed = null;
  const text = parametersDraft.value.trim();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parametersError.value = "Invalid JSON";
      return;
    }
  }
  savingParameters.value = true;
  try {
    await updateLinkParameters(parametersTargetLinkId.value, parsed);
    notify("Parameters saved");
    parametersDialogOpen.value = false;
    await reloadDetail();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Failed to save parameters", { color: "error" });
  } finally {
    savingParameters.value = false;
  }
}

onMounted(async () => {
  await loadTriggers();
  try {
    functions.value = await fetchTriggerFunctions();
  } catch (err) {
    console.warn("Failed to load trigger functions:", err);
  }
});
</script>

<style scoped>
.response-row:not(:last-child) {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
