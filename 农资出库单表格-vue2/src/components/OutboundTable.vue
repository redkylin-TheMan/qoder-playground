<template>
  <div class="table-page">
    <p class="page-desc">
      基于 <strong>ant-design-vue v1.7.8（Vue 2）</strong> 实现。订单级列通过
      <code>customRender</code> 返回 <code>{ children, attrs: { rowSpan } }</code> 实现纵向合并：
      首行取该单总行数，其余行 rowSpan 设 <code>0</code> 被合并。
    </p>

    <a-table
      :columns="columns"
      :data-source="rows"
      :pagination="false"
      bordered
      row-key="key"
      size="middle"
    />
  </div>
</template>

<script>
import {
  orders,
  flattenOrders,
  buildOrderRowSpans,
  formatMoney,
  STATUS_COLOR
} from '../data.js'

export default {
  name: 'OutboundTable',
  data() {
    return {
      rows: flattenOrders(orders)
    }
  },
  computed: {
    // 预计算订单级列的 rowSpan 数组（所有订单级列共用同一份，因为它们按单合并的范围相同）
    orderRowSpans() {
      return buildOrderRowSpans(this.rows)
    },
    columns() {
      // 预计算好的 rowSpan 数组，供所有订单级列复用
      const spans = this.orderRowSpans

      // 订单级列的 customRender：用预计算的 rowSpan 合并单元格
      // antd v1.x 必须返回 { children, attrs: { rowSpan } }
      const mergeCell = (field, renderChildren) => ({
        customRender: (text, row, index) => ({
          children: renderChildren ? renderChildren(row) : text,
          attrs: { rowSpan: spans[index] }
        })
      })

      return [
        {
          title: '单据号', dataIndex: 'orderNo', width: 160, align: 'center',
          ...mergeCell('orderNo')
        },
        {
          title: '出库日期', dataIndex: 'date', width: 120, align: 'center',
          ...mergeCell('date')
        },
        {
          title: '客户', dataIndex: 'customer', width: 150,
          ...mergeCell('customer')
        },
        // ↓↓↓ 明细级列：不合并，每个明细各占一行 ↓↓↓
        { title: '类别', dataIndex: 'category', width: 90, align: 'center' },
        { title: '品种', dataIndex: 'product', width: 170 },
        { title: '仓库', dataIndex: 'warehouse', width: 100, align: 'center' },
        {
          title: '应付金额', dataIndex: 'payable', width: 120, align: 'right',
          customRender: (text) => ({ children: this.renderMoney(text), attrs: {} })
        },
        {
          title: '优惠金额', dataIndex: 'discount', width: 120, align: 'right',
          customRender: (text) => ({ children: this.renderMoney(text, 'red'), attrs: {} })
        },
        {
          title: '优惠后金额', dataIndex: 'final', width: 130, align: 'right',
          customRender: (text) => ({ children: this.renderMoney(text, 'blue'), attrs: {} })
        },
        // ↑↑↑ 明细级列结束 ↑↑↑
        {
          title: '状态', dataIndex: 'status', width: 100, align: 'center',
          customRender: (text, row, index) => ({
            children: this.renderStatusTag(text),
            attrs: { rowSpan: spans[index] }
          })
        },
        {
          title: '录入时间', dataIndex: 'createTime', width: 170, align: 'center',
          ...mergeCell('createTime')
        },
        {
          title: '备注', dataIndex: 'remark', width: 160,
          customRender: (text, row, index) => ({
            children: text || '—',
            attrs: { rowSpan: spans[index] }
          })
        },
        {
          title: '操作', dataIndex: 'action', width: 170, align: 'center',
          customRender: (text, row, index) => ({
            children: this.renderActions(row),
            attrs: { rowSpan: spans[index] }
          })
        }
      ]
    }
  },
  methods: {
    // 渲染金额（v1.7.8 用 JSX 风格的 createElement，这里用 h 函数）
    renderMoney(n, color) {
      const h = this.$createElement
      const cls = ['money']
      if (color === 'red') cls.push('money-red')
      if (color === 'blue') cls.push('money-blue')
      return h('span', { class: cls.join(' ') }, formatMoney(n))
    },
    // 渲染状态 Tag
    renderStatusTag(status) {
      const h = this.$createElement
      return h('a-tag', { props: { color: STATUS_COLOR[status] || 'default' } }, [status])
    },
    // 渲染操作按钮
    renderActions(row) {
      const h = this.$createElement
      // 注意：v1.x 的 a-button 用 on 监听事件
      return h('span', { class: 'action-group' }, [
        h('a-button', { props: { type: 'link', size: 'small' }, on: { click: () => this.onView(row) } }, ['查看']),
        h('a-button', { props: { type: 'link', size: 'small' }, on: { click: () => this.onEdit(row) } }, ['编辑']),
        h('a-button', { props: { type: 'link', size: 'small' }, style: { color: '#ff4d4f' }, on: { click: () => this.onDelete(row) } }, ['删除'])
      ])
    },
    formatMoney,
    onView(row) {
      this.$message.info(`查看单据：${row.orderNo}（${row.customer}）`)
    },
    onEdit(row) {
      this.$message.success(`编辑单据：${row.orderNo}`)
    },
    onDelete(row) {
      this.$message.warning(`删除单据：${row.orderNo}`)
    }
  }
}
</script>

<style lang="less" scoped>
.table-page {
  .page-desc {
    font-size: 13px;
    color: #666;
    line-height: 1.7;
    margin-bottom: 16px;

    code {
      background: #f0f0f0;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 12px;
      color: #c41d7f;
    }
  }

  /deep/ .money {
    font-variant-numeric: tabular-nums;

    &.money-red {
      color: #e34d59;
    }
    &.money-blue {
      color: #1677ff;
      font-weight: 600;
    }
  }

  /deep/ .action-group {
    display: inline-flex;
    gap: 4px;

    .ant-btn {
      padding: 0 4px;
    }
  }
}
</style>
