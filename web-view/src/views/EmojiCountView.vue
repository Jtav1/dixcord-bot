<template>
  <div class="view-page">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Emoji Count</h1>
      <p class="text-body-1 text-medium-emphasis">
        See which emojis are used most by dix.
      </p>
    </header>

    <v-card class="glass-card pa-6">
      <v-card-text class="pa-0">
        <div class="text-center py-12">
          <v-icon size="48" color="primary" class="mb-4">
            mdi-emoticon-happy-outline
          </v-icon>
          <p class="text-h6 mb-2">Leaderboard coming soon</p>
          <p class="text-body-2 text-medium-emphasis">
            Top emoji usage stats will appear here once connected to the API.
          </p>
        </div>

        <v-divider class="my-4" />

        <v-skeleton-loader type="table-heading" class="mb-4" />
        <v-skeleton-loader
          v-for="n in 5"
          :key="n"
          type="list-item-two-line"
          class="mb-2"
        />
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup></script>
