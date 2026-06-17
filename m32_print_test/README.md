# 🖨️ m32_print_test

57mm 宽、长度可变的热敏小票纸 **打印测试工具**（纯前端）。
用于快速验证一台 58mm 热敏小票机在不同长度内容下的走纸、对齐、清晰度表现。

> 纯前端项目，无后端、无数据库，开箱即用。

## 技术栈

- **Vite 5** + 原生 JS / HTML / CSS（零框架依赖）
- 打印核心：CSS `@page { size: 57mm auto; margin: 0 }` + `@media print`
- 构建产物为纯静态文件，可任意静态托管

## 快速开始

```bash
cd m32_print_test
npm install        # 安装 vite
npm run dev        # 启动开发服务器（默认 http://localhost:5320，自动打开）
# 或打包
npm run build      # 输出到 dist/
npm run preview    # 预览构建产物
```

## 关于「选择打印机」的说明（重要）

浏览器 JavaScript **无法**直接枚举系统中的打印机，也无法绕过系统对话框指定某一台。
因此本工具采用符合实际的方案：

1. 在界面顶部填写/保存一个**打印机名称**（仅存于浏览器 `localStorage`，便于识别，非系统级绑定）。
2. 点击「打印」会唤起 **系统打印对话框**，在对话框中：
   - 在顶部下拉框选择你的 **57mm 热敏小票机**；
   - 纸张/纸张尺寸设为 **57mm 宽，长度自动**（若系统无此预设，选自定义尺寸）；
   - 边距设为 **无 / None / 0**（页边距已由小票样式内部 padding 处理）。

## 四个测试项（长度递增）

| 测试项 | 长度 | 说明 |
|--------|------|------|
| 极简纯文字自检 | 短 | 约 5~6 行，验证最小高度与基本清晰度 |
| 模拟收银小票 | 中 | 商品明细 + 合计 + 二维码占位 |
| 模拟快递取件码单 | 中 | 大号取件码 + 物流轨迹时间线 + 条码占位 |
| 模拟长文本/分页测试 | 长 | 多段正文 + 重复说明，验证连续走纸不截断 |

每张小票都有「预览」（屏幕按 57mm 比例显示）和「打印」（注入打印样式后调用 `window.print()`）。

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
    ├── main.js             # 主逻辑：界面渲染 + 打印流程
    ├── receipts.js         # 四张小票的模板与样例数据
    └── styles/
        ├── main.css        # 屏幕界面样式
        └── print.css       # 57mm 可变长打印样式（@media print）
```

## 打印流程原理

1. 屏幕上一切 UI 包在 `#app` 中，`@media print` 下 `display:none`；
2. 空的 `#print-mount` 平时用 `position:absolute; left:-99999px` 隐藏；
3. 点击打印时，把目标小票 HTML（套 `.receipt` 类）注入 `#print-mount`；
4. 调用 `window.print()`，系统对话框弹出 → 用户选打印机与纸张；
5. 监听 `afterprint` 事件清空挂载点。

> 因此「选择打印机」实际发生在系统打印对话框，工具本身只负责把 57mm 可变长内容渲染正确。
