<template>
  <div class="table-page">
    <p class="page-desc">
      基于 <strong>ant-design-vue</strong> 实现。订单级列通过
      <code>customCell</code> 返回 <code>{ rowSpan }</code> 实现纵向合并：
      首行取 <code>record._span</code>，其余行取 <code>0</code> 被合并。
    </p>

    <a-table
      :columns="columns"
      :data-source="dataSource"
      :pagination="false"
      bordered
      row-key="_rowKey"
      size="middle"
    >
      <!-- 状态：Tag 分色 -->
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'payable'">
          <span class="money">{{ formatMoney(record.payable) }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'discount'">
          <span class="money money-red">{{ formatMoney(record.discount) }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'final'">
          <span class="money money-blue">{{ formatMoney(record.final) }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'remark'">
          <span class="remark">{{ record.remark || '—' }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'action'">
          <a-space :size="4">
            <a-button type="link" size="small" @click="onView(record)">查看</a-button>
            <a-button type="link" size="small" @click="onEdit(record)">编辑</a-button>
            <a-button type="link" size="small" danger @click="onDelete(record)">删除</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { message } from 'ant-design-vue'
import { orders, flattenOrders, formatMoney, STATUS_META } from '../data.js'

// 扁平化后的行数据
const dataSource = computed(() => {
  // 给每行一个唯一 key（订单内按明细序号拼接）
  return flattenOrders(orders).map((r, i) => ({ ...r, _rowKey: `${r._orderId}-${i}` }))
})

// 状态 Tag 颜色映射（ant-design-vue 用 color，对应 success/warning/error 等预设色）
function statusColor(status) {
  const tone = STATUS_META[status]?.tone
  if (tone === 'success') return 'success'
  if (tone === 'warning') return 'warning'
  if (tone === 'danger') return 'error'
  return 'default'
}

// 合并单元格核心：订单级列在首行 rowspan=_span，其余行 rowspan=0（被合并）
// 明细级列不配置 customCell，每个明细各占一行。
function mergeOrderCell(record) {
  return { rowSpan: record._isFirst ? record._span : 0 }
}

const columns = [
  { title: '单据号', dataIndex: 'orderNo', width: 160, align: 'center', customCell: mergeOrderCell },
  { title: '出库日期', dataIndex: 'date', width: 120, align: 'center', customCell: mergeOrderCell },
  { title: '客户', dataIndex: 'customer', width: 150, customCell: mergeOrderCell },
  { title: '类别', dataIndex: 'category', width: 90, align: 'center' },
  { title: '品种', dataIndex: 'product', width: 170 },
  { title: '仓库', dataIndex: 'warehouse', width: 100, align: 'center' },
  { title: '应付金额', dataIndex: 'payable', width: 120, align: 'right' },
  { title: '优惠金额', dataIndex: 'discount', width: 120, align: 'right' },
  { title: '优惠后金额', dataIndex: 'final', width: 130, align: 'right' },
  { title: '状态', dataIndex: 'status', width: 100, align: 'center', customCell: mergeOrderCell },
  { title: '录入时间', dataIndex: 'createTime', width: 170, align: 'center', customCell: mergeOrderCell },
  { title: '备注', dataIndex: 'remark', width: 160, customCell: mergeOrderCell },
  { title: '操作', dataIndex: 'action', width: 170, align: 'center', customCell: mergeOrderCell }
]

function onView(record) {
  message.info(`查看单据：${record.orderNo}（${record.customer}）`)
}
function onEdit(record) {
  message.success(`编辑单据：${record.orderNo}`)
}
function onDelete(record) {
  message.warning(`删除单据：${record.orderNo}`)
}
</script>

<style scoped>
.table-page .page-desc {
  font-size: 13px;
  color: #666;
  line-height: 1.7;
  margin-bottom: 16px;
}
.table-page .page-desc code {
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #c41d7f;
}
.money {
  font-variant-numeric: tabular-nums;
}
.money-red {
  color: #e34d59;
}
.money-blue {
  color: #1677ff;
  font-weight: 600;
}
.remark {
  color: #888;
  font-size: 12px;
}
</style>
