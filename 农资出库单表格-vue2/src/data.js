/**
 * 农资出库单 - 共享数据与扁平化逻辑（Vue2 + antd v1.7.8 版）
 * --------------------------------------------------
 * 一张出库单 = 订单级信息 + 多个「品种-仓库」明细。
 * 表格呈现成「合并单元格」：
 *   - 明细级字段（品种/仓库/金额）每个明细占一行
 *   - 订单级字段（单据号/客户/状态...）在所属明细行范围内纵向合并
 *
 * antd v1.x 合并单元格用 customRender + attrs，需要预先算出 rowSpan 数组，
 * 所以这里把"数据扁平化"和"rowSpan 预计算"都放在 data.js 提供。
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

// ==================== 状态样式映射 ====================
// antd v1.x a-tag 用 color 属性，对应预设色名
export const STATUS_COLOR = {
  '已出库': 'green',
  '待审核': 'orange',
  '已作废': 'red'
}

// ==================== 金额格式化 ====================
export function formatMoney(n) {
  return '¥ ' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 把嵌套的订单数据扁平化成一维行数据。
 * 每行 = 订单级字段（平铺） + 明细级字段 + 辅助标记：
 *   _orderId : 订单唯一标识（同单多行相同）
 *   _isFirst : 是否该单首行
 *   _span    : 该单总行数（首行 rowspan 取这个值）
 */
export function flattenOrders(orderList) {
  const rows = []
  orderList.forEach(order => {
    const span = order.items.length
    order.items.forEach((item, idx) => {
      rows.push({
        orderNo: order.orderNo,
        date: order.date,
        customer: order.customer,
        status: order.status,
        createTime: order.createTime,
        remark: order.remark,
        category: item.category,
        product: item.product,
        warehouse: item.warehouse,
        payable: item.payable,
        discount: item.discount,
        final: item.final,
        key: `${order.orderNo}-${idx}`, // antd v1.x Table 的 rowKey
        _orderId: order.orderNo,
        _isFirst: idx === 0,
        _span: span
      })
    })
  })
  return rows
}

/**
 * 预计算 rowSpan 数组（antd v1.x 合并单元格必需）。
 * 对"订单级列"：首行填 _span，其余填 0（被合并）。
 * 返回一个和 rows 等长的数组。
 *
 * antd v1.x 注意：被合并行的 rowSpan 必须显式设 0，
 * 否则单元格不会被隐藏，导致表格错位。
 */
export function buildOrderRowSpans(rows) {
  return rows.map(r => (r._isFirst ? r._span : 0))
}
