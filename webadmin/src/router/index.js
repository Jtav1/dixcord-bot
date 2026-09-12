import { createRouter, createWebHistory } from "vue-router";
import { CLIENTS } from "../nav/clients.js";
import ComingSoonView from "../views/ComingSoonView.vue";
import DashboardView from "../views/DashboardView.vue";
import ConfigView from "../views/ConfigView.vue";
import TriggerResponsesView from "../views/TriggerResponsesView.vue";
import PinQuipsView from "../views/PinQuipsView.vue";
import EightBallView from "../views/EightBallView.vue";
import LinkReplacementsView from "../views/LinkReplacementsView.vue";
import UserMappingsView from "../views/UserMappingsView.vue";
import RemindersView from "../views/RemindersView.vue";
import ActivityView from "../views/ActivityView.vue";
import PinArchiveAdminView from "../views/PinArchiveAdminView.vue";
import AuditLogView from "../views/AuditLogView.vue";

/** Feature key -> component, filled in as each phase's view is built. */
const FEATURE_COMPONENTS = {
  dashboard: DashboardView,
  config: ConfigView,
  triggers: TriggerResponsesView,
  "pin-quips": PinQuipsView,
  "eight-ball": EightBallView,
  "link-replacements": LinkReplacementsView,
  "user-mappings": UserMappingsView,
  reminders: RemindersView,
  activity: ActivityView,
  "pin-archive": PinArchiveAdminView,
  "audit-log": AuditLogView,
};

const firstClient = CLIENTS[0];

/**
 * Application route table, generated from CLIENTS so a feature only needs
 * an entry in nav/clients.js (+ optionally FEATURE_COMPONENTS) to appear.
 * @type {import("vue-router").RouteRecordRaw[]}
 */
const routes = [
  {
    path: "/",
    redirect: `/${firstClient.key}/${firstClient.features[0].key}`,
  },
  ...CLIENTS.flatMap((client) =>
    client.features.map((feature) => ({
      path: `/${client.key}/${feature.key}`,
      name: `${client.key}/${feature.key}`,
      component: FEATURE_COMPONENTS[feature.key] ?? ComingSoonView,
      props: FEATURE_COMPONENTS[feature.key] ? false : { title: feature.label },
      meta: { title: feature.label },
    })),
  ),
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
