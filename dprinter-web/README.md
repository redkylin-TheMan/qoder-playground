# 得力 DB-618KII 针式打印机 · 网页测试平台

一个用于在**网页/本地服务**里测试**得力 DB-618KII（82 列平推式针式打印机，1+3 联）**的平台。
通过表单填写单据 → 本地 Node 服务生成 ESC/P-K 指令 → 走 Windows 打印队列 RAW 模式发送到打印机。

> 适用所有兼容 **EPSON ESC/P 仿真**的针式打印机（得力 / 映美 / OKI / 实达等），不限品牌。

---

## ✨ 特性

- 🖨 **RAW 原始指令打印**：绕过系统 GDI 渲染，直接发 ESC/P-K 字节流，对齐精确、无打印弹窗
- 🛡 **不破坏驱动**：打印机正常装得力驱动、正常使用，本平台只是额外的一条 RAW 通道
- 📋 **5 种测试单据**：粮食入库单 / 出库单 / 增值税发票 / 小票 / 通用三联单（含司机、收款等完整字段）
- 👁 **所见即所得预览**：网页端等宽近似渲染 + ESC/P 指令 hex 查看，打印前先核对
- 🧪 **dryRun 模拟模式**：打印机没接/没纸也能跑通全链路，只看指令不真打
- 🔌 **零原生依赖**：不装 Zadig、不换 WinUSB、不引 Express/iconv，纯 Node + PowerShell，**兼容 Node v10+（实测 v14.21.3）**
- 🪟 **Windows 原生**：使用 `winspool.drv` + `RawPrinterHelper`，商业软件在 Win 上的标准做法

---

## 📐 架构

```
┌───────────────┐   HTTP/JSON    ┌──────────────────┐  child_process  ┌─────────────┐  winspool.drv  ┌─────────────┐
│  浏览器网页    │ ─────────────▶ │  Node 本地服务    │ ──────────────▶ │ PowerShell  │ ─────────────▶ │ 针式打印机    │
│ (表单/预览/日志)│ ◀───────────── │  127.0.0.1:9100  │                 │ raw-print.ps1│  (RAW 字节流)   │ (DB-618KII)  │
└───────────────┘   结果/日志      └──────────────────┘                 └─────────────┘                └─────────────┘
                          │                                              │
                   lib/escp.js                                    GB18030 编码
                  (指令构建器)                                  (PowerShell .NET)
```

**为什么这样设计？**
- 浏览器出于安全不能直接写 USB 原始字节流（WebUSB 对国产针打兼容差且要 HTTPS）
- 用 Node 服务当"桥梁"，PowerShell 侧做 GB18030 编码（覆盖全字符集，不依赖 Node 原生模块）
- 走 `winspool.drv` 的 RAW 通道，不破坏打印机正常驱动

---

## 🚀 快速开始

### 1. 确认环境

```bash
node --version   # 需要 >= 10，实测 v14.21.3 可用
```

### 2. 安装打印机驱动（若已装可跳过）

- 下载得力 DB-618KII 驱动：[中关村在线](https://driver.zol.com.cn/detail/48/473543.shtml) / [打印机驱动网](https://www.dyjqd.com/driver/deli/DB-618KII.html) / [驱动天空](https://www.drvsky.com/deli/DB-618KII.htm)
- 按 USB 连接打印机，在「设备和打印机」里确认出现 `Deli DB-618KII`（或类似名字）
- 记下这个**打印机名称**，待会儿网页里要选

### 3. 启动服务

```bash
cd dprinter-web
node server.js
```

看到：
```
得力 DB-618KII 针式打印机测试平台已启动
浏览器打开:  http://127.0.0.1:9100
```

### 4. 浏览器打开

访问 **http://127.0.0.1:9100**

### 5. 第一次使用（务必先模拟）

1. 左栏选单据类型（如"粮食入库单"）
2. 表单已预填示例数据，可修改
3. 右栏「打印参数」勾选 **☑ 模拟模式（dryRun）**
4. 点 **👁 预览指令** —— 右侧出现等宽预览 + hex
5. 点 **🖨 打印** —— 日志显示 `模拟成功`，不真打
6. 确认指令无误后，**取消勾选** dryRun，选对打印机，再点打印

---

## 📋 单据类型与字段

| 单据 | 关键字段 |
|------|---------|
| **粮食入库单** | 出库重量、入库重量、扣减、单价、金额、制单人、司机(姓名/电话/车牌)、收款(账户/银行/金额/方式) |
| **粮食出库单** | 库存重量、出库重量、扣减、单价、金额、制单人、司机、收款 |
| **增值税发票** | 购销双方、商品明细(名称/数量/单价/金额/税率/税额)、价税合计(大小写)、开票人 |
| **小票/收银票** | 门店、商品列表、合计、付款方式、会员、积分、二维码占位 |
| **通用三联单** | 自定义键值字段 → 自动生成「商户存根/客户存根/财务存根」三联 |

所有字段都可在网页表单修改；商品/字段列表支持动态增删行。

---

## 🔧 API（供你自己的程序调用）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/defaults` | 返回各单据的默认字段 |
| GET | `/api/printers` | 列出系统打印机 + 默认打印机 |
| POST | `/api/preview` | body: `{type, fields}` → 返回预览模型 + 脚本 hex |
| POST | `/api/print` | body: `{type, fields, printerName, copies, dryRun}` → 打印 |

示例（PowerShell 调用打印）：
```powershell
$body = '{"type":"grainIn","printerName":"Deli DB-618KII","copies":1,"dryRun":false}'
Invoke-WebRequest -Uri 'http://127.0.0.1:9100/api/print' -Method POST `
  -Body $body -ContentType 'application/json'
```

---

## 🧪 独立测试（脱离网页）

### 测试 A：ESC/P 指令构建器自检

```bash
node -e "require('./lib/escp').demo()"
```
输出脚本、hex、预览模型，肉眼核对指令正确性。

### 测试 B：给默认打印机发一行测试文本

```bash
npm run ps-test
```
> 注意：`raw-print.ps1` 文件需为 **UTF-8 with BOM** 编码（Windows PowerShell 5.1 要求）。
> 项目已按此编码保存；若你重新编辑后保存为无 BOM，中文注释会导致解析失败，可用以下命令加回 BOM：
> ```powershell
> $p='lib\raw-print.ps1'; $c=[IO.File]::ReadAllText($p,[Text.Encoding]::UTF8)
> [IO.File]::WriteAllText($p,$c,(New-Object Text.UTF8Encoding($true)))
> ```

### 测试 C：手动验证打印通道（不启动服务）

```powershell
powershell -ExecutionPolicy Bypass -File lib\raw-print.ps1 -PrinterName "你的打印机名" -ScriptFile "某脚本.txt" -DryRun
```

---

## 🩺 排错

### 问题 1：`HRESULT: 0x8007007E`（找不到模块）
**原因**：C# P/Invoke 的 DLL 名字错。
**解决**：确认 `raw-print.ps1` 里所有 `[DllImport(...)]` 用的是 **`winspool.drv`**（小写 .drv），不是 `winspool.Dll`。项目已修正，勿改回。

### 问题 2：PowerShell 报中文乱码 / here-string 解析失败
**原因**：`raw-print.ps1` 被保存成无 BOM 的 UTF-8，Windows PowerShell 5.1 按 GBK 读取导致中文注释破坏语法。
**解决**：给 PS 文件加 UTF-8 BOM（见上文"测试 B"下的命令）。

### 问题 3：`PowerShell 执行失败` / 脚本无法运行
**原因**：执行策略限制。
**解决**：以管理员身份运行
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
本平台调用 PS 时已带 `-ExecutionPolicy Bypass`，通常无需改全局策略。

### 问题 4：打印提交成功（OK=1）但打印机不出纸
可能原因：
1. **打印机选错** —— 网页里选的打印机名和实际的不一致（注意全角空格、型号后缀如 `II` vs `Ⅱ`）
2. **端口不支持 RAW** —— 「设备和打印机」→ 右键打印机 → 属性 → 端口 → 确认勾选的是 `USB001` 之类的 USB 端口，且**不要**勾"启用双向支持"以外的特殊项
3. **打印机离线/缺纸** —— 检查打印机面板状态灯
4. **指令兼容性** —— 得力 DB-618KII 兼容 ESC/P，若你的型号不同，可能需调整 `lib/escp.js` 里的初始化序列

### 问题 5：打印出来的内容位置偏 / 走纸不对
- 调整 `lib/escp.js` 的 `feedToTear()` 里的走纸行数（默认 5 行）
- 修改 `documents.js` 各单据的 `lineWidth`（默认 48 半角列）
- 三联纸的撕纸位置因纸厚不同需微调

### 问题 6：端口 9100 被占用
修改 `server.js` 里的 `PORT` 常量。

---

## 📁 项目结构

```
dprinter-web/
├── package.json            # 零运行依赖
├── server.js               # HTTP 服务（127.0.0.1:9100）
├── lib/
│   ├── escp.js             # ESC/P-K 指令构建器（链式 API）
│   ├── printer.js          # 调用 PowerShell 发 RAW 字节流
│   ├── raw-print.ps1       # PowerShell 侧：winspool.drv RAW 打印 + GB18030 编码
│   └── documents.js        # 5 种单据工厂
└── public/
    └── index.html          # 测试网页（单文件）
```

---

## 🔌 切换到"直连 USB"方案（可选，不推荐）

如果你**必须**绕过系统驱动直连 USB（如打印机不装驱动），可改用 `escpos-usb`：
1. `npm i escpos escpos-usb`
2. 用 Zadig 把打印机驱动换成 WinUSB（**会破坏正常打印功能**）
3. 在 `lib/printer.js` 加一个 USB 适配器分支

本平台默认走 RAW 通道，保留了这个扩展点但未实现，因为绝大多数场景 RAW 已足够。

---

## 📚 参考资料

- [得力 DB-618KII 驱动（中关村在线）](https://driver.zol.com.cn/detail/48/473543.shtml)
- [爱普生针式打印机编程指南（ESC/P 参考）](https://www.epson.com.cn/drive/4151379a8ac34e80bb30fd1a6b99915c.html)
- [Mike42: Getting a USB receipt printer working on Windows](https://mike42.me/blog/2015-04-getting-a-usb-receipt-printer-working-on-windows)

---

## ⚖️ 许可

MIT
