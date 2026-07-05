<template>
  <div class="view-page">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">PlusPlus Rankings</h1>
      <p class="text-body-1 text-medium-emphasis">
        Top and dixbot plusplus scoreboards
      </p>
    </header>

    <v-row>
      <v-col cols="12" md="6">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="primary">mdi-trophy-outline</v-icon>
            Top Scores
          </v-card-title>
          <v-card-text class="pa-0">
            <div class="text-center py-8">
              <p class="text-body-2 text-medium-emphasis">
                Rankings will load here once connected to the API.
              </p>
            </div>
            <v-skeleton-loader
              v-for="n in 5"
              :key="n"
              type="list-item-two-line"
              class="mb-2"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card class="glass-card pa-6 h-100">
          <v-card-title class="text-h6 pa-0 mb-4">
            <v-icon start color="secondary">mdi-arrow-down-bold-outline</v-icon>
            Bottom Scores
          </v-card-title>
          <v-card-text class="pa-0">
            <div class="text-center py-8">
              <p class="text-body-2 text-medium-emphasis">
                Rankings will load here once connected to the API.
              </p>
            </div>
            <v-skeleton-loader
              v-for="n in 5"
              :key="n"
              type="list-item-two-line"
              class="mb-2"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup></script>
