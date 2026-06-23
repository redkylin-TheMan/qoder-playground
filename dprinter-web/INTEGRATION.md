# 得力针式打印（三联/票据）功能 · 集成接入文档

> 把本项目的「得力 DB-618KII 针式打印机打印能力」接入到你自己的项目里。
> 适用机型：得力全系 ESC/P-K 兼容针打（DB / DL / DE 系列，82 列与 106 列）。

---

## 1. 这个功能到底做了什么

一条端到端链路：

```
你的业务数据(JSON)  →  ESC/P-K 指令构建  →  GB18030 编码  →  Windows 打印队列(RAW)  →  针式打印机
   (前端/后端)          (lib/escp.js)         (raw-print.ps1)        (winspool)
```

关键点：

- **不依赖任何原生 Node 模块**（没有 `node-printer`、`iconv`、`node-ffi` 这类编译产物）。全部用 Node 内置模块 + Windows 自带的 PowerShell / .NET。
- 中文编码（GB18030）放在 PowerShell 侧用 .NET `Encoding.GetEncoding("GB18030")` 完成，覆盖全字符集，不怕生僻字。
- 发送方式是 **RAW 数据直送打印队列**（`WritePrinter` + `pDataType="RAW"`），绕过 Windows GDI 打印引擎——所以**字粗细/复写深度由 ESC/P 指令控制，不会被驱动渲染层改写**，这是针打复写清晰的前提。

---

## 2. 运行环境要求

| 项 | 要求 |
|----|------|
| 操作系统 | **Windows**（macOS / Linux 无法用此方案，因为没有 winspool / PowerShell） |
| Node.js | ≥ 10（实测 v14.21.3、v22.14.0 均可） |
| PowerShell | 系统自带（`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`） |
| .NET | 系统自带（脚本里用 `Add-Type` 编译 C# P/Invoke） |
| 打印机 | 得力 ESC/P-K 兼容针打，已通过 USB 连接并**在 Windows「设置 - 打印机」里出现** |

> ⚠️ 打印机必须在 Windows 打印队列里**已安装驱动**且处于"就绪"状态。本项目发的是 RAW 指令，但仍需要一个指向该硬件的打印队列对象（哪怕用的是通用驱动）。

---

## 3. 你需要带走的文件

接入时只需复制以下 4 个文件到你的项目，**不需要 `server.js` 和 `public/`**（那俩是自带的演示网页）：

```
dprinter-web/
├── lib/
│   ├── escp.js          ← ESC/P 指令构建器（核心，可独立使用）
│   ├── documents.js     ← 5 种内置单据模板（可按需保留或参考改写）
│   ├── models.js        ← 得力全系型号参数表 + 自动探测
│   └── raw-print.ps1    ← Windows RAW 发送脚本（PowerShell）
```

四个文件相互依赖关系：

```
documents.js ──► escp.js
     │
     └─(型号key)──► models.js

printer.js(发送器) ──► raw-print.ps1 ──► winspool.dll
```

> 注：`printer.js`（发送器）目前在项目根的 `lib/printer.js`，它负责调起 ps1。接入时也一并复制。

---

## 4. 最小可用示例（3 行代码打印一张三联单）

把 `lib/` 目录复制进你的项目后：

```js
const docs = require('./lib/documents');
const printer = require('./lib/printer');

// 1) 用业务数据覆盖默认字段，构建单据
const builder = docs.triplicate({
  companyName: '某某粮油有限公司',
  title: '过磅结算单',
  no: 'GB20260617-0001',
  date: '2026-06-17',
  fields: [
    { k: '货品名称', v: '小麦(一等)' },
    { k: '净重(kg)', v: '1500.5' },
    { k: '金额(元)', v: '4201.40' }
  ]
}, { bold: true }, 'DB-618KII');   // 字体加粗, 型号 DB-618KII

// 2) 序列化成脚本字符串
const script = builder.toScript();

// 3) 发送到打印机（非模拟）
printer.send(script, { printerName: 'Deli DB-618KII', copies: 1, dryRun: false },
  (err, res) => { console.log(err, res); });
```

**强烈建议**第一次先 `dryRun: true`，确认字节无误后再实际打印：

```js
printer.send(script, { printerName: 'Deli DB-618KII', dryRun: true },
  (err, res) => {
    // res.steps 里会有 [copy 1] stdout: BYTES=1138 HEX64=1B 40 1B 74 01 ... DRYRUN=1
  });
```

---

## 5. 核心 API 速查

### 5.1 `documents.js` — 单据工厂

```js
const docs = require('./lib/documents');

// 五种内置单据，签名统一：(fields, font, model) -> EscpBuilder
docs.grainIn(fields, font, model)     // 粮食入库单
docs.grainOut(fields, font, model)    // 粮食出库单
docs.invoice(fields, font, model)     // 增值税专用发票样张
docs.receipt(fields, font, model)     // 小票/收银票（窄版 32 列）
docs.triplicate(fields, font, model)  // 通用三联单（商户/客户/财务）
```

三个参数**均可选**，缺省用内置默认数据填充：

| 参数 | 类型 | 说明 |
|------|------|------|
| `fields` | object | 业务数据，覆盖对应单据的 `DEFAULT_*` 字段。详见 §6 |
| `font` | object | 字体方案，见 §7 |
| `model` | string \| object | 型号。传字符串 key（如 `'DB-618KII'`）或 `{key, lineWidth, feedLines}` |

返回值是 `EscpBuilder` 实例，调它的方法：

```js
const b = docs.triplicate(fields, font, model);
b.toScript();        // → string，发给 printer.send
b.getPreview();      // → 数组，每项 {text, align, bold, dw, dh, blank}，用于前端渲染预览
```

### 5.2 `printer.js` — 发送器

```js
const printer = require('./lib/printer');

// 异步发送（推荐）
printer.send(script, opts, callback);
//   script  : string         toScript() 的产物
//   opts    : { printerName, copies, dryRun }
//   callback: (err, {ok, copies, dryRun, steps, error}) => void

// Promise 版
await printer.sendAsync(script, opts);

// 列出系统打印机（异步，回调式）
printer.listPrinters((err, info) => {
  // info = { defaultPrinter, printers:[], usbIds:[], detectedModel }
});

// 同步版（仅列名字，用于简单场景）
const names = printer.listPrintersSync();   // ['OneNote (Desktop)', 'Deli DB-618KII', ...]
```

### 5.3 `models.js` — 型号表

```js
const models = require('./lib/models');

models.getModel('DB-618KII');
// → { name:'得力 DB-618KII', columns:82, copies:4, lineWidth:48, feedLines:5, ... }

models.getModel('不存在的型号');   // → 自动兜底 GENERIC_82

models.detectModel(['USBPRINT\\DELIDB-618KII\\7&...']);
// → 'DB-618KII'   (按硬件 ID 匹配，用于自动探测)

models.listModels();   // → 全系型号精简清单（给前端下拉框用）
```

### 5.4 `escp.js` — 自定义单据（最灵活）

内置模板不够用时，直接用 `EscpBuilder` 自己拼：

```js
const { EscpBuilder } = require('./lib/escp');

const b = new EscpBuilder({ lineWidth: 48 })   // 行宽 48 半角列
  .init({ bold: true })                         // 初始化 + 字体
  .title('我的自定义单据')                       // 居中倍高倍宽标题
  .separator('=')                               // 填满行宽的分隔线
  .kv('单号', 'NO-001', 48)                     // 左键右值对齐
  .tableRow([                                   // 多列对齐行
    { text: '货品', width: 16 },
    { text: '数量', align: 'right', width: 8 },
    { text: '金额', align: 'right', width: 10 }
  ])
  .feed(2)                                      // 走纸 2 行
  .feedToTear(5);                               // 走纸到撕纸位

printer.send(b.toScript(), { printerName: 'Deli DB-618KII', copies: 1 });
```

**EscpBuilder 全部方法**（都返回 `this`，可链式）：

| 方法 | 作用 |
|------|------|
| `.init(font)` | 必须先调。发 ESC @ 初始化，设中文字符表、字体方案 |
| `.align('left'\|'center'\|'right')` | 对齐方式（持续生效直到再次设置） |
| `.bold(true\|false)` | 西文/正文加粗（ESC E） |
| `.doubleWidth(on)` / `.doubleHeight(on)` | 倍宽/倍高（标题用） |
| `.normalSize()` | 恢复正常字号 |
| `.text(str)` | 输出一行文本（自动换行需自己控制） |
| `.emptyLine()` | 空行 |
| `.feed(n)` | 走纸 n 行 |
| `.feedToTear(lines)` | 走纸到撕纸位（lines 默认 5，随型号） |
| `.separator(ch, width)` | 分隔线，`ch` 默认 `-` |
| `.kv(key, value, width)` | 左键右值对齐行 |
| `.tableRow(cols)` | 多列行，`cols=[{text, align, width}]` |
| `.title(str)` | 居中 + 倍高倍宽 + 粗体标题 |
| `.toScript()` | 序列化成脚本字符串（发往 printer） |
| `.getPreview()` | 取预览模型数组（前端渲染用） |

---

## 6. 各单据的 fields 字段结构

这是接入时你最关心的——**你要从业务系统里取哪些字段喂进去**。所有字段都是字符串（针打不解析数字，按文本走）。

### 6.1 `grainIn` 粮食入库单

```js
{
  companyName: '某某粮油有限公司',
  no: 'RK20260617-0001',        // 单号
  date: '2026-06-17',
  goods: '小麦(一等)',           // 货品名称
  outWeight: '1500.5',          // 出库重量(kg)
  inWeight: '1498.0',           // 入库重量(kg)
  deduction: '2.5',             // 扣减(kg)
  unitPrice: '2.80',            // 单价(元/kg)
  amount: '4194.40',            // 金额(元)
  maker: '张三',                // 制单人
  driverName: '李四',            // 驾驶员
  driverPhone: '138-0000-0001',
  plateNo: '豫A·12345',         // 车牌号
  payee: '某某粮油有限公司',      // 收款账户
  payeeBank: '中国农业银行 某某支行',
  payAmount: '4194.40',
  payMethod: '银行转账'
}
```

### 6.2 `grainOut` 粮食出库单

字段与 `grainIn` **完全一致**，只是语义上 `inWeight` 表示"库存重量"。

### 6.3 `invoice` 增值税发票样张

```js
{
  no: '01100210011112345678',   // 发票号码
  date: '2026-06-17',
  seller: '某某粮油有限公司  纳税人识别号: ...',
  sellerAddr: '地址: ...  电话: ...',   // 可选
  sellerBank: '开户行: ...  账号: ...', // 可选
  buyer: '某某食品有限公司  纳税人识别号: ...',
  items: [                      // 商品明细（数组）
    { name: '小麦(一等)', qty: '5000', price: '2.80', rate: '9%', amount: '14000.00', tax: '1260.00' }
  ],
  totalAmount: '21950.00',      // 合计金额
  totalTax: '1975.50',          // 合计税额
  total: '23925.50',            // 价税合计(小写)
  totalCN: '贰万叁仟玖佰贰拾伍元伍角整',  // 价税合计(大写)
  remark: '备注',
  maker: '张三'
}
```

### 6.4 `receipt` 小票/收银票

```js
{
  store: '某某粮油便利店',
  addr: '河南省郑州市某某路88号',
  phone: '0371-88888888',
  cashier: '001',
  no: '20260617001',
  date: '2026-06-17 14:30:00',
  items: [                      // 商品列表（数组）
    { name: '东北大米5kg', qty: '2', price: '45.00' }
  ],
  payMethod: '微信支付',
  payAmount: '249.00',
  change: '0.00',
  member: '138****0001',        // 可选
  points: '1200'                // 可选
}
```

> 注意：小票固定 32 列窄版（适合 58mm 热敏纸或窄针打），不受 model.lineWidth 影响。

### 6.5 `triplicate` 通用三联单（最通用，推荐接入起点）

```js
{
  companyName: '某某粮油有限公司',
  title: '过磅结算单',
  no: 'GB20260617-0001',
  date: '2026-06-17',
  fields: [                     // 键值对数组（顺序即打印顺序）
    { k: '货品名称', v: '小麦(一等)' },
    { k: '净重(kg)', v: '1500.5' },
    { k: '金额(元)', v: '4201.40' }
  ],
  remark: '本单一式三联：商户存根(红)/客户存根(蓝)/财务存根(黑)'
}
```

> `triplicate` 会自动连续打印 3 份，每份顶部标注「第一联 商户存根 / 第二联 客户存根 / 第三联 财务存根」。你只要提供一份 `fields`，复写份数由物理纸张决定（DB-618KII 是 1+3 联，装 4 层纸即可一次打出 4 份）。

---

## 7. 字体方案 `font`

`font` 对象传给 `.init(font)` 或单据工厂的第二参数。可选字段：

```js
{
  bold:    true,            // ESC E 1，正文加粗（最常用，笔画变粗）
  font:    'hei',           // FS ! 的黑体位，'hei'=黑体（笔画最粗，复写首选）
                            //   不设或 'song' = 宋体
  quality: 'roman',         // ESC x，西文质量：'draft'草书 | 'roman'罗马 | 'sans'无衬线
  spacing: 3,               // ESC SP n，字符间距(n/180英寸)，加宽更清晰
  dark:    true             // 加大击打力（复写多联时字迹更深，部分机型支持）
}
```

预设组合（对应演示网页下拉框）：

| 场景 | font 配置 |
|------|----------|
| 常规 | `{}` |
| **加粗（推荐默认）** | `{ bold: true }` |
| 黑体加粗（复写多联） | `{ bold: true, font: 'hei' }` |
| 加粗+加宽（最清晰） | `{ bold: true, spacing: 3 }` |
| 黑体加粗+加宽（最粗最清晰） | `{ bold: true, font: 'hei', spacing: 3 }` |
| 加粗+大击打力（复写深） | `{ bold: true, dark: true }` |

---

## 8. 型号 `model`

### 传字符串 key（推荐）

```js
docs.triplicate(fields, font, 'DB-618KII');
```

完整 key 见 `lib/models.js` 的 `MODELS` 表，常用的：

| key | 名称 | 列宽 | 复写 |
|-----|------|------|------|
| `DB-618KII` | 得力 DB-618KII（本项目实测） | 82 | 1+3 |
| `DB-615K` / `DB-630K` / `DB-680K` | 平推主力 | 82 | 1+3~4 |
| `DL-730K` | 高速多联 | 82 | 1+7 |
| `DB-690K` | 宽幅 | 106 | 1+5 |
| `GENERIC_82` | 通用兜底（未知型号） | 82 | 1+3 |

### 传对象（覆盖某项参数）

```js
docs.triplicate(fields, font, { key: 'DB-618KII', lineWidth: 46, feedLines: 6 });
```

### 自动探测（推荐接入时用）

让系统自己查 USB 硬件 ID 匹配型号：

```js
printer.listPrinters((err, info) => {
  const modelKey = info.detectedModel || 'GENERIC_82';   // 探测不到就兜底
  const b = docs.triplicate(fields, font, modelKey);
  printer.send(b.toScript(), { printerName: info.defaultPrinter, copies: 1 });
});
```

---

## 9. 三种接入方式

### 方式 A：作为本地 HTTP 服务（前端项目接入最省事）

如果你是前端/全栈项目，不想在业务代码里 require 这些模块，**最简单的办法是让 `dprinter-web` 当一个本地常驻服务**，你的业务前端直接 fetch 它。

`server.js` 暴露的 HTTP API（监听 `127.0.0.1:9100`）：

| 方法 | 路径 | 入参 | 用途 |
|------|------|------|------|
| GET | `/api/printers` | — | 列系统打印机 + 默认机 + 自动探测型号 |
| GET | `/api/models` | — | 得力全系型号清单 |
| GET | `/api/detect` | — | 仅自动探测当前连接的型号 |
| GET | `/api/defaults` | — | 各单据的默认字段（前端预填表单） |
| POST | `/api/preview` | `{type, fields, font, model}` | 返回预览模型 + 脚本 hex（不打印） |
| POST | `/api/print` | `{type, fields, font, model, printerName, copies, dryRun}` | 实际打印 |

业务前端调用示例：

```js
// 实际打印一张三联单
await fetch('http://127.0.0.1:9100/api/print', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'triplicate',
    fields: {
      companyName: '我的公司',
      title: '出库单',
      no: 'CK001',
      date: '2026-06-18',
      fields: [{ k: '物品', v: 'A4纸 1箱' }]
    },
    font: { bold: true },
    model: 'DB-618KII',
    printerName: 'Deli DB-618KII',
    copies: 1,
    dryRun: false
  })
});
```

> ⚠️ 跨域：服务只监听 `127.0.0.1`，如果你的业务页面是 `https://` 的，浏览器会因 mixed content 拦截。解决办法：业务页也走 `http://localhost`，或把 `server.js` 的 `HOST` 改成 `0.0.0.0` 并自行加 HTTPS/鉴权。

**启动服务**：开机后 `cd dprinter-web && node server.js`，或注册成 Windows 服务/计划任务开机自启。

### 方式 B：直接 require 模块（Node 后端接入，最干净）

如果你本身就是 Node 项目，把 `lib/` 复制进去，直接用。无网络、无端口、无额外进程：

```js
// 你的业务路由里
const docs = require('./lib/dprinter-lib/documents');
const printer = require('./lib/dprinter-lib/printer');

app.post('/api/my-business/print-invoice', async (req, res) => {
  const b = docs.invoice(req.body, { bold: true }, 'DB-618KII');
  const result = await printer.sendAsync(b.toScript(), {
    printerName: 'Deli DB-618KII',
    copies: 1,
    dryRun: false
  });
  res.json(result);
});
```

> 注意 `lib/printer.js` 里 `PS1` 路径是 `path.join(__dirname, 'raw-print.ps1')`，复制时保持 ps1 和 printer.js 在同一目录。

### 方式 C：Electron 桌面应用（最丝滑）

Electron 主进程直接 require（方式 B），渲染进程通过 IPC 调主进程。无需本地 HTTP 服务，无跨域问题：

```js
// main.js
const { ipcMain } = require('electron');
const docs = require('./lib/dprinter-lib/documents');
const printer = require('./lib/dprinter-lib/printer');

ipcMain.handle('print-triplicate', async (evt, fields) => {
  const b = docs.triplicate(fields, { bold: true }, 'DB-618KII');
  return printer.sendAsync(b.toScript(), { printerName: 'Deli DB-618KII', copies: 1 });
});
```

---

## 10. 怎么知道我的字段排出来什么样（预览）

两种预览方式，接入时强烈建议先用：

**A. 调 getPreview() 自己渲染**（轻量）：

```js
const b = docs.triplicate(fields, { bold: true }, 'DB-618KII');
const preview = b.getPreview();
// preview = [{text:'某某粮油', align:'center', bold:true, dw:true, dh:true}, ...]
// 用等宽字体按这些标记渲染到网页即可近似看到效果
```

**B. 调 HTTP /api/preview**（拿到 hex 也能核对字节）：

```bash
curl -X POST http://127.0.0.1:9100/api/preview \
  -H "Content-Type: application/json" \
  -d '{"type":"triplicate","fields":{"title":"测试"},"font":{"bold":true},"model":"DB-618KII"}'
```

---

## 11. 自定义你自己的单据模板

内置 5 种不够用时，照着 `documents.js` 的结构新写一个工厂即可。骨架：

```js
const { EscpBuilder } = require('./lib/escp');
const models = require('./lib/models');

function myDoc(fields, font, model) {
  const m = models.getModel(typeof model === 'string' ? model : (model && model.key));
  const W = (model && model.lineWidth) || m.lineWidth || 48;

  const b = new EscpBuilder({ lineWidth: W }).init(font || {});
  b.title(fields.title || '我的单据');
  b.separator('=');
  b.kv('客户', fields.customer, W);
  b.kv('日期', fields.date, W);
  b.separator('-');
  // ... 你自己的排版
  b.feedToTear(m.feedLines);
  return b;
}

module.exports = { myDoc };
```

排版工具见 §5.4 的 `kv` / `tableRow` / `separator` / `feed` 等。

---

## 12. 常见问题排查

| 现象 | 原因 / 解决 |
|------|------------|
| **打印机下拉框只显示 1 台** | 旧版 `printer.js` 有解析 bug（NAMES 多行只取第一行），已于 2026-06-16 修复（改 `\|` 分隔）。确认你的 `lib/printer.js` 是修复后的版本 |
| 打印机完全找不到 | 打开 Windows「设置 - 打印机」确认设备在列且非"脱机"。重启 Print Spooler 服务：`Get-Service Spooler \| Restart-Service` |
| 中文乱码 | ps1 里用 GB18030 编码。确认打印机型号支持 GB18030 字符表（ESC t 1）。少数老机型需改 ESC t 0（GB2312），在 `escp.js` 的 `init()` 改 |
| 字太淡/复写不出最后一联 | 用 `{ bold:true, font:'hei', dark:true }`；检查物理复写纸层数 ≤ 型号 copies |
| 打印卡住/走纸不停 | `feedToTear(lines)` 的 lines 不对，改型号的 feedLines 参数 |
| 报 `OpenPrinter` 失败 | 打印机名拼错，或队列名带后缀（如 "Deli DB-618KII (副本1)"）。用 `listPrinters()` 拿准确名字 |
| PowerShell 执行策略拦截 | 脚本已用 `-ExecutionPolicy Bypass` 调用。若仍被组策略拦截，联系 IT 放行或改用签名 |
| 自动探测不到型号 | USB 硬件 ID 不在 `models.js` 表里。在 `MODELS` 对应型号的 `hwIds` 数组补上你的 ID（运行 `Get-CimInstance Win32_PnPEntity \| ?{$_.PNPDeviceID -like 'USBPRINT*'} \| Select PNPDeviceID` 查看） |

---

## 13. 安全与权限注意

- `printer.js` 通过 `child_process.execFile` 调起 PowerShell。**打印机名 `printerName` 会作为参数传给命令行**，接入到对外的 Web 服务时，务必校验它只含合法打印机名（白名单），防止命令注入。
- `raw-print.ps1` 用了 P/Invoke 直接 `WritePrinter`，能向任意已安装打印机发任意字节。**不要把这个能力暴露到公网**。`server.js` 只监听 `127.0.0.1` 是有意的，对外部署请加反向代理 + 鉴权。
- 临时脚本文件写在 `os.tmpdir()`（如 `C:\Users\xxx\AppData\Local\Temp\dprinter-*.txt`），含业务数据，打印后会被删除，但失败时可能残留，注意磁盘清理。

---

## 14. 速查清单（接入前对照）

- [ ] 复制 `lib/` 四个文件（`escp.js` / `documents.js` / `models.js` / `raw-print.ps1`）+ `printer.js`
- [ ] 确认目标机器是 Windows + Node ≥ 10
- [ ] 打印机已在 Windows「设置 - 打印机」安装就绪
- [ ] 用 `printer.listPrinters()` 拿到准确的 `printerName`
- [ ] 用 `dryRun: true` 先跑一遍核对字节
- [ ] 选好 `font`（默认 `{bold:true}`）和 `model`（默认 `'DB-618KII'` 或自动探测）
- [ ] 字段按 §6 结构从业务系统取数
- [ ] 对外暴露的接口加打印机名白名单校验（§13）

---

*文档基于 dprinter-web 2026-06 版本。如有疑问，对照 `lib/` 源码注释，每个文件头部都有完整设计说明。*
