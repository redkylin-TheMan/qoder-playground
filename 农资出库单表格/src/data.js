/**
 * 农资出库单 - 共享数据与扁平化逻辑
 * --------------------------------------------------
 * 一张出库单 = 订单级信息 + 多个「品种-仓库」明细。
 * 表格要呈现成「合并单元格」效果：
 *   - 明细级字段（品种/仓库/金额）每个明细占一行
 *   - 订单级字段（单据号/客户/状态...）在所属明细行范围内纵向合并
 *
 * 思路：把嵌套数据扁平化成一维行，再对订单级列做 rowspan 合并。
 */

// ==================== 原始订单数据（嵌套结构） ====================
export const orders = [
  {
    orderNo: 'CK20240601001',
    date: '2024-06-01',
    customer: '丰收农资经营部',
    status: '已出库',
    createTime: '2024-06-01 09:32:18',
    remark: '老客户，优先发货',
    items: [
      { category: '化肥', product: '尿素（颗粒）', warehouse: '一号库', payable: 3200, discount: 200, final: 3000 },
      { category: '农药', product: '草甘膦异丙胺盐', warehouse: '二号库', payable: 860, discount: 60, final: 800 }
    ]
  },
  {
    orderNo: 'CK20240601002',
    date: '2024-06-01',
    customer: '利农合作社',
    status: '待审核',
    createTime: '2024-06-01 10:15:42',
    remark: '',
    items: [
      { category: '种子', product: '杂交水稻种', warehouse: '三号库', payable: 5400, discount: 400, final: 5000 },
      { category: '种子', product: '玉米种（甜糯）', warehouse: '三号库', payable: 2700, discount: 200, final: 2500 },
      { category: '化肥', product: '复合肥 45%', warehouse: '一号库', payable: 6800, discount: 500, final: 6300 }
    ]
  },
  {
    orderNo: 'CK20240601003',
    date: '2024-06-02',
    customer: '金穗农资超市',
    status: '已出库',
    createTime: '2024-06-02 08:50:05',
    remark: '现场自提',
    items: [
      { category: '农机', product: '手动喷雾器', warehouse: '工具库', payable: 1500, discount: 0, final: 1500 }
    ]
  },
  {
    orderNo: 'CK20240601004',
    date: '2024-06-02',
    customer: '丰收农资经营部',
    status: '已作废',
    createTime: '2024-06-02 14:22:30',
    remark: '客户取消订单',
    items: [
      { category: '农药', product: '吡虫啉可湿性粉剂', warehouse: '二号库', payable: 480, discount: 30, final: 450 },
      { category: '农药', product: '阿维菌素乳油', warehouse: '二号库', payable: 920, discount: 70, final: 850 }
    ]
  }
]

// ==================== 列分组配置 ====================
// 订单级列：这些列在一张单的多行里需要「纵向合并」
// 明细级列：这些列每个明细占一行，不合并
export const MERGE_COLS = [
  'orderNo', 'date', 'customer', 'status', 'createTime', 'remark', 'action'
]

// ==================== 状态样式映射（两套 UI 共用语义） ====================
// ant-design-vue 的 Tag 用 color，tdesign-vue-next 的 Tag 用 theme；这里用通用 key 再各自映射
export const STATUS_META = {
  '已出库': { tone: 'success', text: '已出库' },
  '待审核': { tone: 'warning', text: '待审核' },
  '已作废': { tone: 'danger', text: '已作废' }
}

// ==================== 金额格式化 ====================
export function formatMoney(n) {
  return '¥ ' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 把嵌套的订单数据扁平化成一维行数据。
 *
 * 每行 = 订单级字段（平铺） + 明细级字段 + 辅助标记：
 *   _orderId : 订单唯一标识（同单的多行相同）
 *   _isFirst : 是否该单的首行（首行才真正渲染订单级单元格，其余行 rowspan=0 被合并）
 *   _span    : 该单的总行数（首行的 rowspan 取这个值）
 */
export function flattenOrders(orderList) {
  const rows = []
  orderList.forEach(order => {
    const span = order.items.length
    order.items.forEach((item, idx) => {
      rows.push({
        // 订单级字段
        orderNo: order.orderNo,
        date: order.date,
        customer: order.customer,
        status: order.status,
        createTime: order.createTime,
        remark: order.remark,
        // 明细级字段
        category: item.category,
        product: item.product,
        warehouse: item.warehouse,
        payable: item.payable,
        discount: item.discount,
        final: item.final,
        // 辅助标记
        _orderId: order.orderNo,
        _isFirst: idx === 0,
        _span: span
      })
    })
  })
  return rows
}
