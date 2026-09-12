<template>
  <v-row>
    <v-col cols="12" md="6">
      <h3 class="text-subtitle-1 font-weight-bold mb-2">Top Emojis</h3>
      <PaginatedTable
        :headers="[{ title: 'Emoji', key: 'emoji' }, { title: 'Uses', key: 'frequency' }]"
        :items="emojiItems"
        :loading="emojiLoading"
        :error="emojiError"
        :page="emojiPage"
        :total-pages="emojiTotalPages"
        empty-text="No emoji usage yet."
        @update:page="loadEmoji"
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
        empty-text="No emoji usage yet."
        @update:page="loadUsers"
      />
    </v-col>
  </v-row>
</template>

<script setup>
import { onMounted } from "vue";
import PaginatedTable from "./PaginatedTable.vue";
import { usePaginatedResource } from "../composables/usePaginatedResource.js";
import { fetchEmojiLeaderboard, fetchEmojiUserLeaderboard } from "../lib/leaderboards.js";

const {
  items: emojiItems,
  loading: emojiLoading,
  error: emojiError,
  page: emojiPage,
  totalPages: emojiTotalPages,
  load: loadEmoji,
} = usePaginatedResource(fetchEmojiLeaderboard, { pageSize: 10 });

const {
  items: userItems,
  loading: userLoading,
  error: userError,
  page: userPage,
  totalPages: userTotalPages,
  load: loadUsers,
} = usePaginatedResource(fetchEmojiUserLeaderboard, { pageSize: 10 });

onMounted(() => {
  void loadEmoji(1);
  void loadUsers(1);
});
</script>
