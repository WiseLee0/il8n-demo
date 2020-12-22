import Vue from "vue";
import App from "./App.vue";
import VueI18n from "vue-i18n";

Vue.use(VueI18n);
Vue.config.productionTip = false;

// 通过选项创建 VueI18n 实例
// const i18n = new VueI18n({
//   locale: "zh",
//   messages: {
//     zh: require("../il8n/zh/entry.js"),
//     en: require("../il8n/en/entry.js"),
//   },
// });

new Vue({
  // i18n,
  render: (h) => h(App),
}).$mount("#app");
