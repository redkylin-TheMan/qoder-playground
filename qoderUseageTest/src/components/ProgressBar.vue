<template>
  <div class="progress-container">
    <div class="header">
      <h1>进度条模拟</h1>
      <p>模拟一个多阶段加载进度条动画，最终按回车键完成</p>
    </div>

    <div class="card">
      <h2 class="section-title">操作面板</h2>
      <div class="control-area">
        <t-button theme="primary" size="large" @click="handleStart" :disabled="isRunning">
          <template #icon>
            <span>▶</span>
          </template>
          开始模拟
        </t-button>
        <t-button theme="default" size="large" @click="handleReset" :disabled="!isRunning">
          重置
        </t-button>
        <t-tag v-if="isRunning" theme="warning" variant="light">运行中...</t-tag>
        <t-tag v-else theme="success" variant="light">就绪</t-tag>
      </div>
    </div>

    <div class="card">
      <h2 class="section-title">进度条</h2>
      <p class="desc">点击"开始模拟"后，进度条将分三个阶段自动推进：0%→30%(3秒) → 30%→50%(6秒) → 50%→99%(2秒)，最后按回车键完成。</p>
      <div ref="progressTarget" class="progress-target"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted } from "vue";
import { createProgressBar } from "../utils/runCustomProgressBar.js";

const progressTarget = ref(null);
const isRunning = ref(false);

let progressInstance = null;

const handleStart = () => {
  if (!progressTarget.value || isRunning.value) return;

  // 先清理旧实例
  if (progressInstance) {
    progressInstance.destroy();
  }

  progressInstance = createProgressBar(progressTarget.value);
  progressInstance.start();
  isRunning.value = true;
};

const handleReset = () => {
  if (progressInstance) {
    progressInstance.destroy();
    progressInstance = null;
  }
  isRunning.value = false;
};

onUnmounted(() => {
  if (progressInstance) {
    progressInstance.destroy();
    progressInstance = null;
  }
});
</script>

<style scoped>
.progress-container {
  padding: 24px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.header h1 {
  color: #333;
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.header p {
  color: #666;
  font-size: 16px;
}

.card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 32px;
  margin-bottom: 24px;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #667eea;
}

.control-area {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.desc {
  color: #666;
  font-size: 14px;
  line-height: 1.8;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #f0f4ff;
  border-radius: 8px;
  border-left: 3px solid #667eea;
}

.progress-target {
  min-height: 80px;
}
</style>
