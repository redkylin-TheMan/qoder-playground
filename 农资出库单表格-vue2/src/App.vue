<template>
  <div class="app-container">
    <h1 class="page-title">农资出库单管理列表</h1>
    <p class="page-subtitle">
      合并单元格展示（Vue 2 + ant-design-vue v1.7.8）：一张单据存在多个「品种-仓库」明细时，
      <strong>单据级信息纵向合并</strong>，<strong>明细级信息分行展示</strong>。
    </p>

    <!-- 说明卡片 -->
    <div class="explain">
      <div class="explain-item">
        <span class="dot dot-merge"></span>
        <span><strong>合并列（订单级）</strong>：单据号、出库日期、客户、状态、录入时间、备注、操作</span>
      </div>
      <div class="explain-item">
        <span class="dot dot-split"></span>
        <span><strong>分行列（明细级）</strong>：类别、品种、仓库、应付金额、优惠金额、优惠后金额</span>
      </div>
    </div>

    <div class="panel">
      <OutboundTable />
    </div>
  </div>
</template>

<script>
import OutboundTable from './components/OutboundTable.vue'

export default {
  name: 'App',
  components: { OutboundTable }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f5f7fa;
  color: #333;
}

.app-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 8px;
}

.page-subtitle {
  font-size: 14px;
  color: #888;
  line-height: 1.7;
  margin-bottom: 20px;
}

.explain {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  background: #fff;
  border-radius: 8px;
  padding: 14px 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  font-size: 13px;
  color: #555;
}

.explain-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.dot-merge {
  background: #fff7e6;
  border: 1px solid #ffd591;
}

.dot-split {
  background: #e6f4ff;
  border: 1px solid #91caff;
}

.panel {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
</style>
