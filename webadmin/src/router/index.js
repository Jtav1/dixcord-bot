import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";

/**
 * Application route table.
 * @type {import("vue-router").RouteRecordRaw[]}
 */
const routes = [
  {
    path: "/",
    name: "home",
    component: HomeView,
    meta: { title: "Home" },
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
