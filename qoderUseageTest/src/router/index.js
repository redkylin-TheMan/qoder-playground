import { createRouter, createWebHashHistory } from "vue-router";

const routes = [
  {
    path: "/",
    redirect: "/credits-stats",
  },
  {
    path: "/credits-stats",
    name: "CreditsStats",
    component: () => import("../components/CreditsStats.vue"),
  },
  {
    path: "/progress-bar",
    name: "ProgressBar",
    component: () => import("../components/ProgressBar.vue"),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
