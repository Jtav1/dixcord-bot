<template>
  <div class="pa-4">
    <v-alert v-if="error" type="error" variant="tonal" density="compact" :text="error" />
    <v-skeleton-loader v-else-if="loading" type="list-item-two-line@2" />
    <p v-else-if="!aliases.length" class="text-body-2 text-medium-emphasis mb-0">
      No guild_members aliases linked to this identity.
    </p>
    <v-table v-else density="compact" class="mapping-aliases-table">
      <thead>
        <tr>
          <th>guild_members.id</th>
          <th>App</th>
          <th>Guild</th>
          <th>Handle</th>
          <th>Nickname</th>
          <th>Roles</th>
          <th>Joined At</th>
          <th>Synced At</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="alias in aliases" :key="alias.id">
          <td>{{ alias.id }}</td>
          <td>{{ alias.app }}</td>
          <td>{{ alias.guildName || alias.guildId }}</td>
          <td>{{ alias.handle || "—" }}</td>
          <td>{{ alias.nickname || "—" }}</td>
          <td>
            <span v-if="!alias.roles?.length">—</span>
            <template v-else>
              <span
                v-for="(role, idx) in alias.roles"
                :key="role.id"
                :style="role.color ? { color: role.color } : undefined"
              >{{ role.name || role.id }}<span v-if="idx < alias.roles.length - 1" class="text-medium-emphasis">, </span></span>
            </template>
          </td>
          <td>{{ alias.joinedAt || "—" }}</td>
          <td>{{ alias.syncedAt }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { fetchAliasesForMapping } from "../lib/guildMembers.js";

const props = defineProps({
  mappingId: { type: Number, required: true },
});

const aliases = ref([]);
const loading = ref(true);
const error = ref("");

onMounted(async () => {
  try {
    aliases.value = await fetchAliasesForMapping(props.mappingId);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load aliases";
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.mapping-aliases-table {
  background: transparent !important;
}
</style>
