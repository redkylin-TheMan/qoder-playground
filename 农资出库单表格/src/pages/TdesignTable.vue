<template>
  <div class="table-page">
    <p class="page-desc">
      基于 <strong>tdesign-vue-next</strong> 实现。整表配一个
      <code>rowspan-and-colspan</code> 函数，按列的 <code>colKey</code> 判断：
      订单级列在首行 <code>rowspan = row._span</code>，其余行返回 <code>0</code> 被合并。
    </p>

    <t-table
      :data="data"
      :columns="columns"
      row-key="_rowKey"
      bordered
      table-layout="fixed"
      :rowspan-and-colspan="mergeCell"
    />
  </div>
</template>

<script setup>
import { computed, h } from 'vue'
import { Tag, Button, MessagePlugin } from 'tdesign-vue-next'
import { orders, flattenOrders, formatMoney, STATUS_META, MERGE_COLS } from '../data.js'

// 扁平化后的行数据
const data = computed(() =>
  flattenOrders(orders).map((r, i) => ({ ...r, _rowKey: `${r._orderId}-${i}` }))
)

// 状态 Tag 主题映射（tdesign-vue-next 用 theme：success/warning/danger/default）
function statusTheme(status) {
  return STATUS_META[status]?.tone || 'default'
}

// 自定义单元格渲染
const columns = computed(() => [
  { colKey: 'orderNo', title: '单据号', width: 160, align: 'center' },
  { colKey: 'date', title: '出库日期', width: 120, align: 'center' },
  { colKey: 'customer', title: '客户', width: 150 },
  { colKey: 'category', title: '类别', width: 90, align: 'center' },
  { colKey: 'product', title: '品种', width: 170 },
  { colKey: 'warehouse', title: '仓库', width: 100, align: 'center' },
  {
    colKey: 'payable',
    title: '应付金额',
    width: 120,
    align: 'right',
    cell: (h, { row }) => h('span', { class: 'money' }, formatMoney(row.payable))
  },
  {
    colKey: 'discount',
    title: '优惠金额',
    width: 120,
    align: 'right',
    cell: (h, { row }) => h('span', { class: 'money money-red' }, formatMoney(row.discount))
  },
  {
    colKey: 'final',
    title: '优惠后金额',
    width: 130,
    align: 'right',
    cell: (h, { row }) => h('span', { class: 'money money-blue' }, formatMoney(row.final))
  },
  {
    colKey: 'status',
    title: '状态',
    width: 100,
    align: 'center',
    cell: (h, { row }) =>
      h(Tag, { theme: statusTheme(row.status), variant: 'light' }, () => row.status)
  },
  { colKey: 'createTime', title: '录入时间', width: 170, align: 'center' },
  {
    colKey: 'remark',
    title: '备注',
    width: 160,
    cell: (h, { row }) =>
      h('span', { class: 'remark' }, row.remark || '—')
  },
  {
    colKey: 'action',
    title: '操作',
    width: 170,
    align: 'center',
    cell: (h, { row }) =>
      h('div', { style: { display: 'flex', gap: '4px', justifyContent: 'center' } }, [
        h(Button, { theme: 'primary', variant: 'text', size: 'small', onClick: () => onView(row) }, () => '查看'),
        h(Button, { theme: 'warning', variant: 'text', size: 'small', onClick: () => onEdit(row) }, () => '编辑'),
        h(Button, { theme: 'danger', variant: 'text', size: 'small', onClick: () => onDelete(row) }, () => '删除')
      ])
  }
])

/**
 * TDesign 合并单元格函数。
 * 参数：{ row, rowIndex, col, colIndex }
 * 返回 { rowspan, colspan }，rowspan=0 表示该单元格被上方合并掉。
 */
function mergeCell({ row, col }) {
  // 只对「订单级列」做纵向合并
  if (!MERGE_COLS.includes(col.colKey)) {
    return
  }
  return {
    rowspan: row._isFirst ? row._span : 0,
    colspan: 1
  }
}

function onView(record) {
  MessagePlugin.info(`查看单据：${record.orderNo}（${record.customer}）`)
}
function onEdit(record) {
  MessagePlugin.success(`编辑单据：${record.orderNo}`)
}
function onDelete(record) {
  MessagePlugin.warning(`删除单据：${record.orderNo}`)
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
  color: #d54941;
}
/* tdesign 单元格内渲染的 class 需要用 :deep 穿透 scoped */
.table-page :deep(.money) {
  font-variant-numeric: tabular-nums;
}
.table-page :deep(.money-red) {
  color: #e34d59;
}
.table-page :deep(.money-blue) {
  color: #0052d9;
  font-weight: 600;
}
.table-page :deep(.remark) {
  color: #888;
  font-size: 12px;
}
</style>
