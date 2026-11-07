import { createRouter, createWebHistory } from "vue-router";
import { GLOBAL_FEATURES, BOT_FEATURES } from "../nav/clients.js";
import ComingSoonView from "../views/ComingSoonView.vue";
import DashboardView from "../views/DashboardView.vue";
import ConfigView from "../views/ConfigView.vue";
import TriggerResponsesView from "../views/TriggerResponsesView.vue";
import PinQuipsView from "../views/PinQuipsView.vue";
import EightBallView from "../views/EightBallView.vue";
import LinkReplacementsView from "../views/LinkReplacementsView.vue";
import UserMappingsView from "../views/UserMappingsView.vue";
import UnmappedUsersView from "../views/UnmappedUsersView.vue";
import RemindersView from "../views/RemindersView.vue";
import ActivityView from "../views/ActivityView.vue";
import MilestonesView from "../views/MilestonesView.vue";
import PinArchiveAdminView from "../views/PinArchiveAdminView.vue";
import AuditLogView from "../views/AuditLogView.vue";
import ReactForRoleView from "../views/ReactForRoleView.vue";
import GuildEmojisView from "../views/GuildEmojisView.vue";

/** Feature key -> component, filled in as each phase's view is built. */
const FEATURE_COMPONENTS = {
  dashboard: DashboardView,
  config: ConfigView,
  triggers: TriggerResponsesView,
  "pin-quips": PinQuipsView,
  "eight-ball": EightBallView,
  "link-replacements": LinkReplacementsView,
  "user-mappings": UserMappingsView,
  "unmapped-users": UnmappedUsersView,
  reminders: RemindersView,
  activity: ActivityView,
  milestones: MilestonesView,
  "pin-archive": PinArchiveAdminView,
  "audit-log": AuditLogView,
  "react-for-role": ReactForRoleView,
  "guild-emojis": GuildEmojisView,
};

/**
 * Application route table, generated from nav/clients.js so a feature only needs an entry
 * there (+ optionally FEATURE_COMPONENTS) to appear. Global features live at `/global/:feature`;
 * per-bot features live at `/bot/:app/:guildId/:feature`, with `app`/`guildId` real route params
 * (not guessed from the path) read directly by each bot-scoped view.
 * @type {import("vue-router").RouteRecordRaw[]}
 */
const routes = [
  { path: "/", redirect: `/global/${GLOBAL_FEATURES[0].key}` },
  ...GLOBAL_FEATURES.map((feature) => ({
    path: `/global/${feature.key}`,
    name: `global/${feature.key}`,
    component: FEATURE_COMPONENTS[feature.key] ?? ComingSoonView,
    props: FEATURE_COMPONENTS[feature.key] ? false : { title: feature.label },
    meta: { title: feature.label },
  })),
  ...BOT_FEATURES.map((feature) => ({
    path: `/bot/:app/:guildId/${feature.key}`,
    name: `bot/${feature.key}`,
    component: FEATURE_COMPONENTS[feature.key] ?? ComingSoonView,
    props: FEATURE_COMPONENTS[feature.key] ? false : { title: feature.label },
    meta: { title: feature.label },
  })),
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
