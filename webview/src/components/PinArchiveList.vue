<template>
  <div>
    <template v-if="loading">
      <v-skeleton-loader
        v-for="n in skeletonCount"
        :key="`pin-skeleton-${n}`"
        type="article"
        class="mb-4"
      />
    </template>

    <p
      v-else-if="entries.length === 0"
      class="text-body-2 text-medium-emphasis text-center py-8"
    >
      No pinned messages recorded yet.
    </p>

    <template v-else>
      <article
        v-for="(entry, index) in entries"
        :key="entry.id"
        class="pin-entry"
      >
        <v-divider v-if="index > 0" class="my-4" />

        <header class="d-flex flex-wrap align-center justify-space-between ga-2 mb-2">
          <span class="text-body-1">
            <span class="font-weight-bold">
              {{ resolveMappingLabel(entry.author, nameMap) }}
            </span>
            <span class="text-medium-emphasis ml-2">
              {{ resolveChannelLabel(entry) }}
            </span>
          </span>
          <span class="text-caption text-medium-emphasis">
            {{ formatPinTimestamp(entry.timestamp) }}
          </span>
        </header>

        <p
          v-if="entry.contents"
          class="text-body-2 pin-contents mb-3"
        >
          {{ resolvePinContents(entry.contents, platformNameMap) }}
        </p>

        <div
          v-if="entry.attachments?.length"
          class="pin-attachments mb-3"
        >
          <div
            v-for="path in entry.attachments"
            :key="`${entry.id}-${path}`"
            class="pin-attachment mb-2"
          >
            <p
              v-if="isAttachmentUnavailable(path)"
              class="text-body-2 text-medium-emphasis mb-0"
            >
              [Attachment Unavailable]
            </p>
            <img
              v-else-if="attachmentKind(path) === 'image'"
              :src="pinAttachmentUrl(path)"
              :alt="attachmentFileName(path)"
              class="pin-attachment-image"
              loading="lazy"
              @error="markAttachmentUnavailable(path)"
            />
            <video
              v-else-if="attachmentKind(path) === 'video'"
              :src="pinAttachmentUrl(path)"
              class="pin-attachment-video"
              controls
              preload="metadata"
              @error="markAttachmentUnavailable(path)"
            />
            <a
              v-else
              :href="pinAttachmentUrl(path)"
              target="_blank"
              rel="noopener noreferrer"
              class="text-body-2"
            >
              {{ attachmentFileName(path) }}
            </a>
          </div>
        </div>

        <p class="text-body-2 text-medium-emphasis mb-0">
          <v-icon size="14" class="mr-1" aria-hidden="true">mdi-pin-outline</v-icon>
          Pinned by: {{ resolvePinnerLabels(entry.pinners, nameMap) }}
        </p>
      </article>

      <div
        v-if="totalPages > 1"
        class="d-flex justify-center mt-6"
      >
        <v-pagination
          :model-value="page"
          :length="totalPages"
          density="compact"
          total-visible="7"
          @update:model-value="$emit('update:page', $event)"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import {
  PIN_PAGE_SIZE,
  attachmentFileName,
  attachmentKind,
  formatPinTimestamp,
  isValidAttachmentPath,
  pinAttachmentUrl,
  resolveChannelLabel,
  resolveMappingLabel,
  resolvePinContents,
  resolvePinnerLabels,
} from "../lib/pinArchive.js";

const props = defineProps({
  entries: {
    type: Array,
    default: () => [],
  },
  total: {
    type: Number,
    default: 0,
  },
  offset: {
    type: Number,
    default: 0,
  },
  page: {
    type: Number,
    default: 1,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  nameMap: {
    type: Map,
    default: () => new Map(),
  },
  platformNameMap: {
    type: Map,
    default: () => new Map(),
  },
  skeletonCount: {
    type: Number,
    default: PIN_PAGE_SIZE,
  },
});

defineEmits(["update:page"]);

/** Attachment paths that failed to load or HEAD probe. */
const unavailablePaths = ref(new Set());

/**
 * Total pagination pages from row count and page size.
 * @returns {number}
 */
const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.total / PIN_PAGE_SIZE)),
);

watch(
  () => props.entries,
  () => {
    unavailablePaths.value = new Set();
    void probeFileAttachments();
  },
  { immediate: true },
);

/**
 * Whether an attachment path is marked unavailable.
 * @param {string} path Stored attachment path.
 * @returns {boolean}
 */
function isAttachmentUnavailable(path) {
  const key = String(path ?? "");
  if (!key || !isValidAttachmentPath(key)) return true;
  return unavailablePaths.value.has(key);
}

/**
 * Record a failed attachment load.
 * @param {string} path Stored attachment path.
 * @returns {void}
 */
function markAttachmentUnavailable(path) {
  const key = String(path ?? "");
  if (!key) return;
  const next = new Set(unavailablePaths.value);
  next.add(key);
  unavailablePaths.value = next;
}

/**
 * HEAD-probe file attachments (`other/`) for availability.
 * @returns {Promise<void>}
 */
async function probeFileAttachments() {
  const filePaths = [];
  for (const entry of props.entries) {
    for (const path of entry.attachments ?? []) {
      if (attachmentKind(path) === "file") {
        filePaths.push(String(path));
      }
    }
  }

  await Promise.all(
    filePaths.map(async (path) => {
      try {
        const res = await fetch(pinAttachmentUrl(path), { method: "HEAD" });
        if (!res.ok) markAttachmentUnavailable(path);
      } catch {
        markAttachmentUnavailable(path);
      }
    }),
  );
}
</script>

<style scoped>
.pin-contents {
  white-space: pre-wrap;
  word-break: break-word;
}

.pin-attachment-image {
  display: block;
  max-width: 100%;
  max-height: 24rem;
  border-radius: 4px;
  object-fit: contain;
}

.pin-attachment-video {
  display: block;
  max-width: 100%;
  max-height: 24rem;
  border-radius: 4px;
}
</style>
