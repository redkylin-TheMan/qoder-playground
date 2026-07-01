# 农资出库单表格（Vue 2 + ant-design-vue v1.7.8）

一张出库单可能包含多个「品种-仓库」明细，表格渲染成：
- **订单级信息**（单据号、出库日期、客户、状态、录入时间、备注、操作）→ 纵向**合并**为一个大单元格
- **明细级信息**（类别、品种、仓库、应付金额、优惠金额、优惠后金额）→ 每个明细**分行**显示

依赖版本严格对齐真实项目 `liangyizhilian-drying-fe`（Vue 2.6.14 + antd 1.7.8 + vue-cli 5），
测试结果可直接迁移回去。

## 技术栈

- Vue 2.6.14 + vue-cli（webpack）
- ant-design-vue 1.7.8（前缀 `a-`）
- less

## 运行

```bash
npm install --registry=https://registry.npmmirror.com   # 用淘宝镜像源，避免转圈
npm run serve      # http://localhost:3120 （自动打开）
```

## 关键：antd v1.7.8 合并单元格（与 v4 完全不同！）

| | antd v4（Vue3） | **antd v1.7.8（Vue2，本项目）** |
|---|---|---|
| 合并写法 | `customCell: () => ({ rowSpan })` | **`customRender: (text,row,index) => ({ children, attrs: { rowSpan } })`** |
| rowSpan=0 | 自动隐藏 | 必须显式设 `0`，否则单元格错位 |
| 坑 | — | **不要用 `customCell`** 做 rowspan（v1.x 有 #4399 bug） |

### 实现思路

1. **数据扁平化**（`src/data.js`）：嵌套「订单 → 多明细」扁平化成一维行，每行带 `_isFirst`（是否首行）、`_span`（该单总行数）。
2. **预计算 rowSpan 数组**：`buildOrderRowSpans` 生成与 data 等长的数组，首行填 `_span`、其余填 `0`。
3. **列配置**：订单级列用 `customRender` 返回 `{ children, attrs: { rowSpan: spans[index] } }`；明细级列正常渲染。

```js
// data.js
export function buildOrderRowSpans(rows) {
  return rows.map(r => (r._isFirst ? r._span : 0))
}

// OutboundTable.vue 列配置
const spans = this.orderRowSpans
{
  title: '单据号', dataIndex: 'orderNo',
  customRender: (text, row, index) => ({
    children: text,
    attrs: { rowSpan: spans[index] }   // 首行=总行数，被合并行=0
  })
}
```

## 目录结构

```
农资出库单表格-vue2/
├── package.json
├── vue.config.js
├── babel.config.js
├── public/index.html
├── README.md
└── src/
    ├── main.js                       # Vue.use(Antd) + antd.css + this.$message
    ├── App.vue                       # 页面骨架 + 说明卡片
    ├── data.js                       # 模拟数据 + 扁平化 + rowSpan 预计算
    └── components/
        └── OutboundTable.vue         # antd v1.7.8 Table，customRender 合并
```

## 样式 / 注册写法（对齐真实项目）

```js
// main.js
import Vue from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/antd.css'   // 纯 CSS，无需 less-loader
import { message } from 'ant-design-vue'
Vue.use(Antd)
Vue.prototype.$message = message
```
