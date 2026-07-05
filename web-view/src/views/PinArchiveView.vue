<template>
  <div class="view-page">
    <header class="view-header mb-6">
      <h1 class="text-h4 font-weight-bold mb-2">Pin Archive</h1>
      <p class="text-body-1 text-medium-emphasis">
        Browse pinned messages recorded in the dixbot archives
      </p>
    </header>

    <v-card class="glass-card pa-6">
      <v-card-text class="pa-0">
        <div class="text-center py-12">
          <v-icon size="48" color="primary" class="mb-4">
            mdi-pin-outline
          </v-icon>
          <p class="text-h6 mb-2">No pins loaded yet</p>
          <p class="text-body-2 text-medium-emphasis">
            Pin history will appear here once connected to the API.
          </p>
        </div>

        <v-divider class="my-4" />

        <div v-for="n in 4" :key="n" class="d-flex align-center ga-4 py-3">
          <v-skeleton-loader type="avatar" />
          <v-skeleton-loader type="text@2" class="flex-grow-1" />
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup></script>
