<template>
  <t-layout class="app-layout">
    <!-- 侧边栏 -->
    <t-aside class="app-aside">
      <div class="logo-area">
        <span class="logo-text">Qoder 工作台</span>
      </div>
      <t-menu
        :value="activeMenu"
        theme="light"
        class="app-menu"
        @change="handleMenuChange"
      >
        <t-submenu value="data-stats" title="数据统计">
          <template #icon>
            <span class="menu-icon">📊</span>
          </template>
          <t-menu-item value="/credits-stats">
            <span class="menu-icon">📈</span>
            qoder计费统计
          </t-menu-item>
        </t-submenu>
        <t-submenu value="small-tests" title="小测试">
          <template #icon>
            <span class="menu-icon">🧪</span>
          </template>
          <t-menu-item value="/progress-bar">
            <span class="menu-icon">⏳</span>
            进度条模拟
          </t-menu-item>
        </t-submenu>
      </t-menu>
    </t-aside>

    <!-- 主内容区 -->
    <t-layout class="main-layout">
      <t-content class="main-content">
        <router-view />
      </t-content>
    </t-layout>
  </t-layout>
</template>

<script setup>
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const activeMenu = ref("/credits-stats");

// 根据当前路由同步菜单高亮
watch(
  () => route.path,
  (path) => {
    activeMenu.value = path;
  },
  { immediate: true },
);

const handleMenuChange = (value) => {
  router.push(value);
};
</script>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
}
</style>

<style scoped>
.app-layout {
  height: 100vh;
  width: 100vw;
}

.app-aside {
  width: 240px !important;
  min-width: 240px;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.06);
  z-index: 10;
}

.logo-area {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #e8e8e8;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}

.app-menu {
  flex: 1;
  overflow-y: auto;
  padding-top: 8px;
  border-right: none;
}

.menu-icon {
  margin-right: 4px;
  font-size: 16px;
}

.main-layout {
  flex: 1;
  background: #f5f7fa;
  overflow: hidden;
}

.main-content {
  height: 100%;
  overflow-y: auto;
  padding: 0;
}
</style>
