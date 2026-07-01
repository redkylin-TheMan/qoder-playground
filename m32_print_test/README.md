# 🖨️ m32_print_test

58mm 宽、长度可变的热敏小票纸 **打印测试工具**（纯前端）。
用于快速验证一台 58mm 热敏小票机在不同长度内容下的走纸、对齐、清晰度表现。

> 纯前端项目，无后端、无数据库，开箱即用。

## 技术栈

- **Vite 5** + 原生 JS / HTML / CSS（零框架依赖）
- **qrcode** —— 粮食小票二维码生成（生成真实可扫 dataURL）
- 打印核心：CSS `@page { size: 58mm auto; margin: 3.5mm }` + `@media print`
- 构建产物为纯静态文件，可任意静态托管

## ⚠️ Node 版本要求

Vite 5 需要 **Node 18+**。本机用 nvm 管理多版本，构建/运行前请切换：

```bash
nvm use 22.14.0   # 或 v20.19.3
```

## 快速开始

```bash
nvm use 22.14.0
cd m32_print_test
npm install        # 安装 vite + qrcode
npm run dev        # 启动开发服务器（默认 http://localhost:5320，自动打开）
# 或打包
npm run build      # 输出到 dist/
npm run preview    # 预览构建产物
```

## 两个 Tab（测试单元相互独立）

| Tab | 内容 | 说明 |
|--------|------|------|
| 🧾 通用小票 | 4 张长度递增的样例 | 极简自检 / 收银小票 / 取件码单 / 长文本分页 |
| 🌾 粮食出入库小票 | 6 张 | 字段与主项目 (EntryV1.vue / Exit.vue) 1:1 对齐 |

### 🌾 粮食小票测试项（6 张）

每类小票配「完整数据」和「缺省数据」两组，验证标准排版与缺省容错（`-` / 现场散单 / 兜底金额）：

| 测试项 | 对应主项目 | 完整 | 缺省 |
|--------|-----------|------|------|
| 出库结算小票 | `PrintDialog.vue` | `grain-exit-full` | `grain-exit-sparse` |
| 入库结算小票 | `EntryV1.vue` 结算 | `grain-inbound-full` | `grain-inbound-sparse` |
| 入库回皮凭证 | `EntryV1.vue` gross-ticket | `grain-gross-full` | `grain-gross-sparse` |

- **二维码**：用 `qrcode` 库生成真实 dataURL，payload 与主项目一致：
  - 出库 `{no, type:'exit', c:验码}`
  - 入库结算 `{no, type:'inbound'}`
  - 回皮 `{no, type:'tare'}`
- **样式**：CSS 类名 `rcpt-*` 与主项目新版式（2026-06-23，58mm 纵向卷纸）完全一致，测试结果可直接套用回主项目。

## 关于「选择打印机」的说明（重要）

浏览器 JavaScript **无法**直接枚举系统中的打印机，也无法绕过系统对话框指定某一台。
因此本工具采用符合实际的方案：

1. 在界面顶部填写/保存一个**打印机名称**（仅存于浏览器 `localStorage`，便于识别，非系统级绑定）。
2. 点击「打印」会唤起 **系统打印对话框**，在对话框中：
   - 在顶部下拉框选择你的 **58mm 热敏小票机**；
   - 纸张/纸张尺寸设为 **58mm 宽，长度自动**（若系统无此预设，选自定义尺寸）；
   - 边距设为 **无 / None / 0**（页边距已由小票样式内部 padding / `@page margin` 处理）。

## 打印对不齐 / 被截断怎么办

| 现象 | 处理 |
|------|------|
| 左右贴边或被裁切 | 增大 `src/styles/print.css` 中 `.receipt` 的 `padding`（默认 2mm） |
| 内容中途截断 | 检查系统对话框纸张是否设为「长度自动 / 连续」，而非固定 A4 |
| 条码/二维码块没出来 | 对话框勾选「背景图形 / Background graphics」 |
| 字号太大/太小 | 调整 `print.css` 中 `.receipt { font-size }` |
| 金额编号对不齐 | 使用等宽字体（默认 Consolas / Courier），勿改成比例字体 |

## 目录结构

```
m32_print_test/
├── index.html              # 入口 HTML
├── package.json
├── vite.config.js
├── README.md
└── src/
    ├── main.js             # 主逻辑：Tab 切换 + 界面渲染 + 打印流程
    ├── receipts.js         # 通用小票：4 张模板与样例数据
    ├── grain/              # 🌾 粮食小票（独立测试单元）
    │   ├── formatUtil.js   #   formatN / amountInWords / tail8 (移植自主项目)
    │   ├── grainTemplates.js  # 出库/入库/回皮 三套 rcpt 模板
    │   └── grainSamples.js    # 6 组 mock 数据 (完整 + 缺省)
    └── styles/
        ├── main.css        # 屏幕界面样式
        ├── print.css       # 通用小票 58mm 可变长打印样式
        ├── grain-print.css     # 🌾 粮食小票 58mm 打印样式 (@page + rcpt-*)
        └── grain-preview.css   # 🌾 粮食小票屏幕预览样式
```

## 打印流程原理

1. 屏幕上一切 UI 包在 `#app` 中，`@media print` 下 `display:none`；
2. 空的 `#print-mount` 平时用 `position:absolute; left:-99999px` 隐藏；
3. 点击打印时：
   - 通用小票：把目标小票 HTML（套 `.receipt` 类）注入 `#print-mount`；
   - 粮食小票：先用 `qrcode` 生成 dataURL，再用 `rcpt-*` 模板渲染（套 `.grain-receipt` 类）注入；
4. 调用 `window.print()`，系统对话框弹出 → 用户选打印机与纸张；
5. 监听 `afterprint` 事件清空挂载点。

> 因此「选择打印机」实际发生在系统打印对话框，工具本身只负责把 58mm 可变长内容渲染正确。
