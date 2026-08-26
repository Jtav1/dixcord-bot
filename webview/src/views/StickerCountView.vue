<template>
  <div class="view-page view-page--wide">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Sticker Count</h1>
      <p class="text-body-1 text-medium-emphasis">
        See which stickers are used most by dix, and which users use them the
        most. Sorry Justin actually hasn't implemented tracking sticker usage
        yet so this is kind of a placeholder lmao
      </p>
    </header>

    <v-row>
      <v-col cols="12" md="6">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="primary">mdi-sticker-emoji</v-icon>
            Top Stickers
          </v-card-title>
          <v-card-text class="pa-0">
            <v-alert
              type="info"
              variant="tonal"
              title="Work in progress"
              text="Sticker leaderboards are coming soon."
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="secondary">mdi-account-group-outline</v-icon>
            Top Sticker Users
          </v-card-title>
          <v-card-text class="pa-0">
            <v-alert
              type="info"
              variant="tonal"
              title="Work in progress"
              text="Per-user sticker rankings are coming soon."
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
