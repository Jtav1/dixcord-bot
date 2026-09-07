import { createApp } from "vue";
import App from "./App.vue";
import router from "./router/index.js";
import vuetify from "./plugins/vuetify.js";
import "./style.css";

function main() {
  createApp(App).use(vuetify).use(router).mount("#app");
}

main();
