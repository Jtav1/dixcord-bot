import { createRouter, createWebHistory } from "vue-router";
import PinArchiveView from "../views/PinArchiveView.vue";
import EmojiCountView from "../views/EmojiCountView.vue";
import StickerCountView from "../views/StickerCountView.vue";
import PlusPlusRankingsView from "../views/PlusPlusRankingsView.vue";
import StatisticsView from "../views/StatisticsView.vue";
import SystemStatusView from "../views/SystemStatusView.vue";

/**
 * Application route table.
 * @type {import("vue-router").RouteRecordRaw[]}
 */
const routes = [
  {
    path: "/",
    redirect: "/system-status",
  },
  {
    path: "/pin-archive",
    name: "pin-archive",
    component: PinArchiveView,
    meta: { title: "Pin Archive" },
  },
  {
    path: "/emoji-count",
    name: "emoji-count",
    component: EmojiCountView,
    meta: { title: "Emoji Count" },
  },
  {
    path: "/sticker-count",
    name: "sticker-count",
    component: StickerCountView,
    meta: { title: "Sticker Count" },
  },
  {
    path: "/plusplus-rankings",
    name: "plusplus-rankings",
    component: PlusPlusRankingsView,
    meta: { title: "PlusPlus Rankings" },
  },
  {
    path: "/statistics",
    name: "statistics",
    component: StatisticsView,
    meta: { title: "Statistics" },
  },
  {
    path: "/system-status",
    name: "system-status",
    component: SystemStatusView,
    meta: { title: "System Status" },
  },
];

/**
 * Vue Router instance for the application.
 * @returns {import("vue-router").Router}
 */
const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
