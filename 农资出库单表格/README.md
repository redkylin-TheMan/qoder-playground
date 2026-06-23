# 农资出库单管理列表（合并单元格）

一张出库单可能包含多个「品种-仓库」明细，需要把表格渲染成：
- **订单级信息**（单据号、出库日期、客户、状态、录入时间、备注、操作）→ 纵向**合并**为一个大单元格
- **明细级信息**（类别、品种、仓库、应付金额、优惠金额、优惠后金额）→ 每个明细**分行**显示

同一个项目里用 **ant-design-vue** 与 **tdesign-vue-next** 各实现一遍，顶部 Tab 切换。

## 技术栈

- Vue 3 + Vite
- ant-design-vue（前缀 `a-`）
- tdesign-vue-next（前缀 `t-`，两个库前缀不冲突，同时全局注册）

## 运行

```bash
npm install
npm run dev      # http://localhost:3100 （自动打开）
```

## 实现原理

### 1. 数据扁平化（`src/data.js`）

把嵌套的「订单 → 多明细」扁平化成一维行数组。每行带三个辅助标记：

| 字段 | 含义 |
|------|------|
| `_orderId` | 订单唯一标识，同单的多行相同 |
| `_isFirst` | 是否该单的首行 |
| `_span` | 该单的总行数（首行 rowspan 取这个值） |

### 2. 合并单元格（两套库的关键差异）

**ant-design-vue**：对每个订单级列配置 `customCell`：

```js
function mergeOrderCell(record) {
  return { rowSpan: record._isFirst ? record._span : 0 }
}
// 列配置里：customCell: mergeOrderCell
```

**tdesign-vue-next**：整表配一个 `rowspan-and-colspan` 函数，按列的 `colKey` 判断：

```js
function mergeCell({ row, col }) {
  if (!MERGE_COLS.includes(col.colKey)) return        // 明细列不合并
  return { rowspan: row._isFirst ? row._span : 0, colspan: 1 }
}
```

> 两个库返回 `0` 都表示该单元格被上方单元格合并掉。

## 目录结构

```
农资出库单表格/
├── package.json
├── vite.config.js
├── index.html
├── README.md
└── src/
    ├── main.js             # 全局注册 antd + tdesign
    ├── App.vue             # Tab 切换两个实现
    ├── data.js             # 模拟数据 + 扁平化 + 金额/状态映射
    └── pages/
        ├── AntdTable.vue   # ant-design-vue 实现
        └── TdesignTable.vue # tdesign-vue-next 实现
```
