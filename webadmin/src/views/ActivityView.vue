<template>
  <div class="view-page view-page--wide">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Leaderboards &amp; Events</h1>
      <p class="text-body-1 text-medium-emphasis">Activity rankings and raw tracking events</p>
    </header>

    <v-tabs v-model="tab" color="primary" class="mb-6">
      <v-tab value="plusplus">PlusPlus</v-tab>
      <v-tab value="emoji">Emoji</v-tab>
      <v-tab value="stickers">Stickers</v-tab>
      <v-tab value="repost">Repost</v-tab>
      <v-tab value="events">Raw Events</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="plusplus"><PlusplusLeaderboardPanel /></v-window-item>
      <v-window-item value="emoji"><EmojiLeaderboardPanel /></v-window-item>
      <v-window-item value="stickers"><StickerLeaderboardPanel /></v-window-item>
      <v-window-item value="repost"><RepostLeaderboardPanel /></v-window-item>
      <v-window-item value="events"><RawEventsPanel /></v-window-item>
    </v-window>
  </div>
</template>

<script setup>
import { ref } from "vue";
import PlusplusLeaderboardPanel from "../components/PlusplusLeaderboardPanel.vue";
import EmojiLeaderboardPanel from "../components/EmojiLeaderboardPanel.vue";
import StickerLeaderboardPanel from "../components/StickerLeaderboardPanel.vue";
import RepostLeaderboardPanel from "../components/RepostLeaderboardPanel.vue";
import RawEventsPanel from "../components/RawEventsPanel.vue";

const tab = ref("plusplus");
</script>
