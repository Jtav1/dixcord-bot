import { createRouter, createWebHistory } from "vue-router";
import PinArchiveView from "../views/PinArchiveView.vue";
import EmojiCountView from "../views/EmojiCountView.vue";
import PlusPlusRankingsView from "../views/PlusPlusRankingsView.vue";

/**
 * Application route table.
 * @type {import("vue-router").RouteRecordRaw[]}
 */
const routes = [
  {
    path: "/",
    redirect: "/pin-archive",
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
    path: "/plusplus-rankings",
    name: "plusplus-rankings",
    component: PlusPlusRankingsView,
    meta: { title: "PlusPlus Rankings" },
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
