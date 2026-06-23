'use strict';
/*
 * lib/escp.js — ESC/P-K 指令构建器（得力 DB-618KII / EPSON 仿真针式打印机通用）
 * ---------------------------------------------------------------------------
 * 设计目标：
 *   1) 链式 API，易读易写
 *   2) 同时输出「真实字节指令」和「可读预览模型」，供网页近似渲染
 *   3) 零依赖，纯 Node Buffer，兼容 Node v10+（实测 v14.21.3）
 *
 * 关于中文编码：
 *   本构建器内部以「逻辑字符」为单位组织内容（字符串字段保持 UTF-8），
 *   不在这里做 GB18030 转换。实际发往打印机前，由 lib/printer.js 通过
 *   PowerShell 侧 .NET 的 Encoding.GetEncoding("GB18030") 统一转换 —— 这样
 *   可以覆盖全 GB18030 字符集，且不依赖任何 Node 原生/iconv 模块。
 *
 * 字符宽度约定（用于预览对齐）：
 *   - 半角字符（ASCII）= 1 列
 *   - 全角字符（中文等）= 2 列
 *   82 列针打 = 一行约 82 个半角位（A4 横向）/ 通常单据用 40~48 半角位列宽
 */

// ============== ESC/P 常用控制码 ==============
var ESC = 0x1B;
var GS  = 0x1D;
var FS  = 0x1C;

function byte() {
  // byte(27, 64) -> <Buffer 1b 40>
  var args = Array.prototype.slice.call(arguments);
  return Buffer.from(args);
}

// 计算「显示宽度」：全角=2，半角=1
function dispWidth(str) {
  if (str == null) return 0;
  str = String(str);
  var w = 0;
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    // 基本汉字/全角区按 2 计；简易判定，够单据用
    if (code >= 0x1100 && code <= 0x115F ||        // 谚文
        code >= 0x2E80 && code <= 0xA4CF ||        // 中日韩部首/笔划
        code >= 0xAC00 && code <= 0xD7A3 ||        // 韩文音节
        code >= 0xF900 && code <= 0xFAFF ||        // 兼容汉字
        code >= 0xFE30 && code <= 0xFE4F ||        // CJK 兼容形式
        code >= 0xFF00 && code <= 0xFF60 ||        // 全角符号/字母
        code >= 0xFFE0 && code <= 0xFFE6 ||        // 全角货币
        code >= 0x3000 && code <= 0x303F ||        // CJK 标点
        code >= 0x3040 && code <= 0x33FF) {        // 假名/注音/CJK 符号
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

// 按显示宽度截断/填充
function padRight(str, width) {
  str = String(str == null ? '' : str);
  var w = dispWidth(str);
  if (w >= width) return str;
  return str + new Array(width - w + 1).join(' ');
}
function padLeft(str, width) {
  str = String(str == null ? '' : str);
  var w = dispWidth(str);
  if (w >= width) return str;
  return new Array(width - w + 1).join(' ') + str;
}
function truncate(str, width) {
  str = String(str == null ? '' : str);
  var out = '';
  var w = 0;
  for (var i = 0; i < str.length; i++) {
    var cw = dispWidth(str[i]);
    if (w + cw > width) break;
    out += str[i];
    w += cw;
  }
  return out;
}

// ============== 构建器 ==============
function EscpBuilder(opts) {
  opts = opts || {};
  this.lineWidth = opts.lineWidth || 48;   // 默认单据行宽（半角位列数）
  this.parts = [];        // 指令段：{type:'raw'|'text', data}
  this.preview = [];      // 预览模型：每行 {text, align, bold, dw, dh}
  this._align = 'left';
  this._bold = false;
  this._dw = false;       // double width
  this._dh = false;       // double height
}

// 把一段文本同时写入「指令」和「预览」
EscpBuilder.prototype._pushTextLine = function (text) {
  this.parts.push({ type: 'text', data: text });
  this.preview.push({
    text: text,
    align: this._align,
    bold: this._bold,
    dw: this._dw,
    dh: this._dh
  });
};

// ---- 基础控制 ----
// font 配置（DB-618KII / EPSON 仿真，可选字段）：
//   bold        : true  正文全局加粗(ESC E)   —— 字笔画变粗，最直接
//   font        : 'song'|'hei'|'kai'         ESC k 0=宋体 1=楷 2=黑体（部分机型）
//   quality     : 'draft'|'roman'|'sans'      ESC x 0=草书 1=书写体 2=罗马(无衬线)
//   spacing     : 0~n                        ESC SP n  字符间距(n/180英寸)，0=默认
EscpBuilder.prototype.init = function (font) {
  font = font || {};
  this.parts.push({ type: 'raw', data: byte(ESC, 0x40) });          // ESC @  初始化（清除所有字体设置）
  this.parts.push({ type: 'raw', data: byte(ESC, 0x74, 0x01) });    // ESC t 1  选择 GB18030 字符表
  this.parts.push({ type: 'raw', data: byte(FS, 0x26) });           // FS &    选择中文模式

  // 中文字体：FS ! 是 ESC/P-K 的中文综合设置(位标志)：
  //   bit0=双宽 bit1=双高 bit2=加粗 bit3=宋/黑(1=黑体) bit4=斜体 bit5=下划线
  //   —— 用它一次性设中文黑体+加粗，比 ESC k 更可靠（DB-618KII 支持）
  var fontBit = 0;
  if (font.bold) fontBit |= 0x04;       // 加粗
  if (font.font === 'hei') fontBit |= 0x08; // 黑体
  if (fontBit) {
    this.parts.push({ type: 'raw', data: byte(FS, 0x21, fontBit) }); // FS ! n  中文字体综合
    this._bold = !!font.bold; // 同步预览状态
  }

  // 西文字体质量/族（可选）
  if (font.quality === 'roman') {
    this.parts.push({ type: 'raw', data: byte(ESC, 0x78, 0x01) });   // ESC x 1  罗马(无衬线，较清晰)
  } else if (font.quality === 'sans') {
    this.parts.push({ type: 'raw', data: byte(ESC, 0x6B, 0x01) });   // ESC k 1  无衬线
  } else if (font.quality === 'draft') {
    this.parts.push({ type: 'raw', data: byte(ESC, 0x78, 0x00) });   // ESC x 0  草书(最快但较淡)
  }

  // 全局正文加粗兜底（确保 FS ! 不被某些机型忽略时仍加粗）
  if (font.bold) {
    this.parts.push({ type: 'raw', data: byte(ESC, 0x45, 0x01) });   // ESC E 1
  }

  // 字符间距（加宽更清晰，尤其针打复写时）
  if (font.spacing && font.spacing > 0) {
    this.parts.push({ type: 'raw', data: byte(ESC, 0x20, font.spacing & 0xFF) }); // ESC SP n
  }

  // 针打击打力：DB-618KII 支持 ESC ( 行指令调击打档位(力度)，复写多联时更清晰
  //   这里通过 ESC 7 n (打印浓度/力度) —— 部分得力机型支持；无效会被忽略，无害
  if (font.dark) {
    this.parts.push({ type: 'raw', data: byte(ESC, 0x37, 0x02) });   // 加大击打力档(尽力而为)
  }

  return this;
};

// 设置默认行宽（用于对齐辅助）
EscpBuilder.prototype.setLineWidth = function (w) {
  this.lineWidth = w;
  return this;
};

// ---- 对齐 ----
EscpBuilder.prototype.align = function (a) {
  // left=0 center=1 right=2
  var n = a === 'center' ? 1 : (a === 'right' ? 2 : 0);
  this._align = a;
  this.parts.push({ type: 'raw', data: byte(ESC, 0x61, n) });       // ESC a n
  return this;
};

// ---- 字体样式 ----
EscpBuilder.prototype.bold = function (on) {
  this._bold = !!on;
  this.parts.push({ type: 'raw', data: byte(ESC, 0x45, on ? 1 : 0) }); // ESC E n
  return this;
};

// 倍宽/倍高（针打常用：标题用倍高倍宽）
EscpBuilder.prototype.doubleWidth = function (on) {
  this._dw = !!on;
  this.parts.push({ type: 'raw', data: byte(GS, 0x21, (this._dw ? 0x20 : 0) | (this._dh ? 0x01 : 0)) });
  return this;
};
EscpBuilder.prototype.doubleHeight = function (on) {
  this._dh = !!on;
  this.parts.push({ type: 'raw', data: byte(GS, 0x21, (this._dw ? 0x20 : 0) | (this._dh ? 0x01 : 0)) });
  return this;
};
EscpBuilder.prototype.normalSize = function () {
  this._dw = false; this._dh = false;
  this.parts.push({ type: 'raw', data: byte(GS, 0x21, 0x00) });
  return this;
};

// ---- 文本输出 ----
EscpBuilder.prototype.text = function (t) {
  this._pushTextLine(t == null ? '' : String(t));
  return this;
};
EscpBuilder.prototype.emptyLine = function () {
  this._pushTextLine('');
  return this;
};

// 换行/走纸 n 行
EscpBuilder.prototype.feed = function (n) {
  n = n || 1;
  this.parts.push({ type: 'raw', data: byte(ESC, 0x64, n) });        // ESC d n  走纸 n 行
  for (var i = 0; i < n; i++) this.preview.push({ text: '', align: 'left', blank: true });
  return this;
};

// 走纸到撕纸位置（针打撕纸槽）—— ESC/P: ESC Q / 或简单多走几行
// lines: 走纸行数（因型号进纸机构不同有差异），默认 5
EscpBuilder.prototype.feedToTear = function (lines) {
  var n = lines || 5;
  this.parts.push({ type: 'raw', data: byte(ESC, 0x64, n) });        // ESC d n  多走 n 行到撕纸位
  for (var i = 0; i < n; i++) this.preview.push({ text: '', align: 'left', blank: true });
  // 退纸到撕纸位（部分机型支持）
  this.parts.push({ type: 'raw', data: byte(ESC, 0x4A, 0x00) });
  return this;
};

// ---- 高层排版辅助 ----

// 一条分隔线（默认用 - 填满行宽）
EscpBuilder.prototype.separator = function (ch, width) {
  ch = ch || '-';
  width = width || this.lineWidth;
  var w = dispWidth(ch) || 1;
  var n = Math.max(1, Math.floor(width / w));
  var line = '';
  for (var i = 0; i < n; i++) line += ch;
  this._pushTextLine(line);
  return this;
};

// 键值对齐行：  左对齐键 + 右对齐值（或冒号分隔）
//   kv('出库重量', '1500.5 kg')  ->  出库重量            1500.5 kg
EscpBuilder.prototype.kv = function (key, value, width) {
  width = width || this.lineWidth;
  var k = String(key == null ? '' : key);
  var v = String(value == null ? '' : value);
  var kw = dispWidth(k), vw = dispWidth(v);
  if (kw + vw <= width) {
    var gap = width - kw - vw;
    this._pushTextLine(k + new Array(gap + 1).join(' ') + v);
  } else {
    this._pushTextLine(k + '  ' + truncate(v, width - kw - 2));
  }
  return this;
};

// 表格行：cols=[{text, align, width}, ...]  width 为半角位列宽
EscpBuilder.prototype.tableRow = function (cols) {
  var cells = [];
  for (var i = 0; i < cols.length; i++) {
    var c = cols[i];
    var w = c.width || 10;
    var t = truncate(c.text == null ? '' : String(c.text), w);
    if (c.align === 'right') cells.push(padLeft(t, w));
    else if (c.align === 'center') {
      var tw = dispWidth(t);
      var left = Math.floor((w - tw) / 2);
      cells.push(new Array(left + 1).join(' ') + t + new Array(w - tw - left + 1).join(' '));
    } else cells.push(padRight(t, w));
  }
  this._pushTextLine(cells.join(' '));
  return this;
};

// 标题行（居中 + 倍高倍宽 + 可选粗体）
EscpBuilder.prototype.title = function (t) {
  this.align('center');
  this.bold(true);
  this.doubleHeight(true).doubleWidth(true);
  this._pushTextLine(String(t == null ? '' : t));
  this.normalSize();
  this.bold(false);
  this.align('left');
  return this;
};

// 两栏并排：left / right 各自靠边
EscpBuilder.prototype.twoCol = function (left, right, width) {
  return this.kv(left, right, width);
};

// ============== 输出 ==============

// 序列化成「字符串脚本」——交给 printer.js，由 PowerShell 侧做 GB18030 编码后发 RAW。
// 格式约定：纯文本按行输出，控制指令用 \xNN 形式的转义（PS 侧解析）。
// 为简化，我们采用「转义字符串」方案：把不可见控制码用 \u001b 等转义写进一个字符串。
EscpBuilder.prototype.toScript = function () {
  var lines = [];
  for (var i = 0; i < this.parts.length; i++) {
    var p = this.parts[i];
    if (p.type === 'raw') {
      // 控制码段：用 JSON.stringify 保证字节安全转义
      lines.push('@@RAW@@' + p.data.toString('latin1'));
    } else {
      lines.push(p.data);   // 文本行（原样 UTF-8）
    }
  }
  // 用 \n 连接，但文本本身不应包含 \n（构建器按行处理）
  return lines.join('\n');
};

// 预览模型（供网页渲染）
EscpBuilder.prototype.getPreview = function () {
  return this.preview.slice();
};

// demo：自检，node -e "require('./lib/escp').demo()" 打印 hex 与预览
function demo() {
  var b = new EscpBuilder()
    .init()
    .title('粮食入库单')
    .separator('=')
    .kv('单号', 'RK20260617-001')
    .kv('日期', '2026-06-17')
    .separator()
    .tableRow([
      { text: '货品', align: 'left', width: 16 },
      { text: '重量(kg)', align: 'right', width: 12 },
      { text: '单价', align: 'right', width: 10 },
      { text: '金额', align: 'right', width: 10 }
    ])
    .tableRow([
      { text: '小麦(一等)', width: 16 },
      { text: '1500.5', align: 'right', width: 12 },
      { text: '2.80', align: 'right', width: 10 },
      { text: '4201.40', align: 'right', width: 10 }
    ])
    .separator()
    .feed(2)
    .feedToTear();

  var script = b.toScript();
  console.log('===== ESC/P SCRIPT =====');
  console.log(script);
  console.log('\n===== HEX (latin1 视图) =====');
  console.log(Buffer.from(script, 'latin1').toString('hex').match(/.{1,64}/g).join('\n'));
  console.log('\n===== PREVIEW MODEL =====');
  var pv = b.getPreview();
  for (var i = 0; i < pv.length; i++) {
    var ln = pv[i];
    console.log('[' + (ln.align[0].toUpperCase()) + (ln.bold ? 'B' : ' ') + (ln.dw ? 'W' : ' ') + '] ' + (ln.text || '(空行)'));
  }
  return b;
}

exports.EscpBuilder = EscpBuilder;
exports.demo = demo;
exports.dispWidth = dispWidth;
exports.padRight = padRight;
exports.padLeft = padLeft;
exports.truncate = truncate;
