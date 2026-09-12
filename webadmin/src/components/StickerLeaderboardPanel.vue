<template>
  <v-row>
    <v-col cols="12" md="6">
      <h3 class="text-subtitle-1 font-weight-bold mb-2">Top Stickers</h3>
      <PaginatedTable
        :headers="[{ title: 'Sticker', key: 'emoji' }, { title: 'Uses', key: 'frequency' }]"
        :items="stickerItems"
        :loading="stickerLoading"
        :error="stickerError"
        :page="stickerPage"
        :total-pages="stickerTotalPages"
        empty-text="No sticker usage yet."
        @update:page="loadStickers"
      />
    </v-col>
    <v-col cols="12" md="6">
      <h3 class="text-subtitle-1 font-weight-bold mb-2">Top Users</h3>
      <PaginatedTable
        :headers="[{ title: 'User', key: 'name' }, { title: 'Uses', key: 'total' }]"
        :items="userItems"
        :loading="userLoading"
        :error="userError"
        :page="userPage"
        :total-pages="userTotalPages"
        empty-text="No sticker usage yet."
        @update:page="loadUsers"
      />
    </v-col>
  </v-row>
</template>

<script setup>
import { onMounted } from "vue";
import PaginatedTable from "./PaginatedTable.vue";
import { fetchStickerLeaderboard, fetchStickerUserLeaderboard } from "../lib/leaderboards.js";
import { usePaginatedResource } from "../composables/usePaginatedResource.js";

const {
  items: stickerItems,
  loading: stickerLoading,
  error: stickerError,
  page: stickerPage,
  totalPages: stickerTotalPages,
  load: loadStickers,
} = usePaginatedResource(fetchStickerLeaderboard, { pageSize: 10 });

const {
  items: userItems,
  loading: userLoading,
  error: userError,
  page: userPage,
  totalPages: userTotalPages,
  load: loadUsers,
} = usePaginatedResource(fetchStickerUserLeaderboard, { pageSize: 10 });

onMounted(() => {
  void loadStickers(1);
  void loadUsers(1);
});
</script>
