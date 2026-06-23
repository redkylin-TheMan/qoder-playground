"""escp.py — ESC/P-K 指令构建器（移植自 dprinter-web/lib/escp.js）

设计目标：
  1) 链式 API，易读易写
  2) 同时输出「真实字节指令」和「可读预览模型」
  3) 纯标准库，零原生依赖

关于中文编码：
  本构建器内部以「逻辑字符」为单位组织内容（Python 字符串即 Unicode），
  不在这里做 GB18030 转换。实际发往打印机前，由 raw_printer.py 在
  winspool 写入阶段统一 GB18030 编码 —— 这样可以覆盖全 GB18030 字符集，
  且不依赖任何第三方编码库。

字符宽度约定（用于预览对齐）：
  - 半角字符（ASCII）= 1 列
  - 全角字符（中文等）= 2 列
  82 列针打 = 一行约 82 个半角位；单据通常用 40~48 半角位列宽

脚本序列化格式（to_script 返回 list[str]）：
  与 dprinter-web 完全一致，每行一个元素：
    - 以 "@@RAW@@" 开头的行：其后字符是 latin1 控制码字节（原样发送）
    - 其余行：UTF-8 文本（中文），发送时做 GB18030 编码 + 行末补 LF
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

# ============== ESC/P 常用控制码 ==============
ESC = 0x1B
GS = 0x1D
FS = 0x1C


def _bytes(*codes: int) -> bytes:
    """_bytes(0x1B, 0x40) -> b'\\x1b@'"""
    return bytes(codes)


def disp_width(text: Any) -> int:
    """计算「显示宽度」：全角=2，半角=1"""
    if text is None:
        return 0
    s = str(text)
    w = 0
    for ch in s:
        code = ord(ch)
        if (
            0x1100 <= code <= 0x115F        # 谚文
            or 0x2E80 <= code <= 0xA4CF     # 中日韩部首/笔划
            or 0xAC00 <= code <= 0xD7A3     # 韩文音节
            or 0xF900 <= code <= 0xFAFF     # 兼容汉字
            or 0xFE30 <= code <= 0xFE4F     # CJK 兼容形式
            or 0xFF00 <= code <= 0xFF60     # 全角符号/字母
            or 0xFFE0 <= code <= 0xFFE6     # 全角货币
            or 0x3000 <= code <= 0x303F     # CJK 标点
            or 0x3040 <= code <= 0x33FF     # 假名/注音/CJK 符号
        ):
            w += 2
        else:
            w += 1
    return w


def pad_right(text: Any, width: int) -> str:
    s = "" if text is None else str(text)
    w = disp_width(s)
    if w >= width:
        return s
    return s + " " * (width - w)


def pad_left(text: Any, width: int) -> str:
    s = "" if text is None else str(text)
    w = disp_width(s)
    if w >= width:
        return s
    return " " * (width - w) + s


def truncate(text: Any, width: int) -> str:
    s = "" if text is None else str(text)
    out = ""
    w = 0
    for ch in s:
        cw = disp_width(ch)
        if w + cw > width:
            break
        out += ch
        w += cw
    return out


# ============== 构建器 ==============
class EscpBuilder:
    """ESC/P-K 指令构建器。所有排版方法返回 self，可链式调用。"""

    def __init__(self, opts: Optional[Dict[str, Any]] = None) -> None:
        opts = opts or {}
        self.line_width: int = int(opts.get("lineWidth", 48))  # 默认单据行宽（半角列）
        self.parts: List[Tuple[str, Any]] = []  # ('raw', bytes) | ('text', str)
        self.preview: List[Dict[str, Any]] = []  # 每行 {text, align, bold, dw, dh, blank?}
        self._align = "left"
        self._bold = False
        self._dw = False  # double width
        self._dh = False  # double height

    # 把一段文本同时写入「指令」和「预览」
    def _push_text_line(self, text: Any) -> "EscpBuilder":
        self.parts.append(("text", "" if text is None else str(text)))
        self.preview.append({
            "text": "" if text is None else str(text),
            "align": self._align,
            "bold": self._bold,
            "dw": self._dw,
            "dh": self._dh,
        })
        return self

    # ---- 基础控制 ----
    def init(self, font: Optional[Dict[str, Any]] = None) -> "EscpBuilder":
        """初始化打印机 + 设置中文模式 + 字体方案。

        font 可选字段：
          bold    : True  正文全局加粗(ESC E)
          font    : 'song'|'hei'|'kai'   FS ! 的黑体位（'hei'=黑体，复写首选）
          quality : 'draft'|'roman'|'sans'
          spacing : 0~n    ESC SP n 字符间距(n/180英寸)
          dark    : True   加大击打力（复写多联时字迹更深）
        """
        font = font or {}
        self.parts.append(("raw", _bytes(ESC, 0x40)))           # ESC @  初始化
        self.parts.append(("raw", _bytes(ESC, 0x74, 0x01)))     # ESC t 1  选择 GB18030 字符表
        self.parts.append(("raw", _bytes(FS, 0x26)))            # FS &    选择中文模式

        # 中文字体：FS ! 综合位标志
        #   bit0=双宽 bit1=双高 bit2=加粗 bit3=宋/黑(1=黑体) bit4=斜体 bit5=下划线
        font_bit = 0
        if font.get("bold"):
            font_bit |= 0x04      # 加粗
        if font.get("font") == "hei":
            font_bit |= 0x08      # 黑体
        if font_bit:
            self.parts.append(("raw", _bytes(FS, 0x21, font_bit)))  # FS ! n
            self._bold = bool(font.get("bold"))

        quality = font.get("quality")
        if quality == "roman":
            self.parts.append(("raw", _bytes(ESC, 0x78, 0x01)))   # ESC x 1 罗马
        elif quality == "sans":
            self.parts.append(("raw", _bytes(ESC, 0x6B, 0x01)))   # ESC k 1 无衬线
        elif quality == "draft":
            self.parts.append(("raw", _bytes(ESC, 0x78, 0x00)))   # ESC x 0 草书

        if font.get("bold"):
            self.parts.append(("raw", _bytes(ESC, 0x45, 0x01)))   # ESC E 1 兜底加粗

        spacing = font.get("spacing")
        if spacing and int(spacing) > 0:
            self.parts.append(("raw", _bytes(ESC, 0x20, int(spacing) & 0xFF)))  # ESC SP n

        if font.get("dark"):
            # ESC 7 n 加大击打力（部分得力机型支持；无效会被忽略，无害）
            self.parts.append(("raw", _bytes(ESC, 0x37, 0x02)))
        return self

    def set_line_width(self, w: int) -> "EscpBuilder":
        self.line_width = int(w)
        return self

    # ---- 对齐 ----
    def align(self, a: str) -> "EscpBuilder":
        n = 1 if a == "center" else (2 if a == "right" else 0)
        self._align = a
        self.parts.append(("raw", _bytes(ESC, 0x61, n)))  # ESC a n
        return self

    # ---- 字体样式 ----
    def bold(self, on: bool) -> "EscpBuilder":
        self._bold = bool(on)
        self.parts.append(("raw", _bytes(ESC, 0x45, 1 if on else 0)))  # ESC E n
        return self

    def double_width(self, on: bool) -> "EscpBuilder":
        self._dw = bool(on)
        self.parts.append(("raw", _bytes(GS, 0x21, (0x20 if self._dw else 0) | (0x01 if self._dh else 0))))
        return self

    def double_height(self, on: bool) -> "EscpBuilder":
        self._dh = bool(on)
        self.parts.append(("raw", _bytes(GS, 0x21, (0x20 if self._dw else 0) | (0x01 if self._dh else 0))))
        return self

    def normal_size(self) -> "EscpBuilder":
        self._dw = False
        self._dh = False
        self.parts.append(("raw", _bytes(GS, 0x21, 0x00)))
        return self

    # ---- 文本输出 ----
    def text(self, t: Any) -> "EscpBuilder":
        return self._push_text_line("" if t is None else str(t))

    def empty_line(self) -> "EscpBuilder":
        return self._push_text_line("")

    def feed(self, n: int = 1) -> "EscpBuilder":
        n = int(n) or 1
        self.parts.append(("raw", _bytes(ESC, 0x64, n)))  # ESC d n 走纸 n 行
        for _ in range(n):
            self.preview.append({"text": "", "align": "left", "blank": True})
        return self

    def feed_to_tear(self, lines: Optional[int] = None) -> "EscpBuilder":
        """走纸到撕纸位（针打撕纸槽）。lines 默认 5。"""
        n = int(lines) if lines else 5
        self.parts.append(("raw", _bytes(ESC, 0x64, n)))  # ESC d n 多走 n 行到撕纸位
        for _ in range(n):
            self.preview.append({"text": "", "align": "left", "blank": True})
        # 退纸到撕纸位（部分机型支持）
        self.parts.append(("raw", _bytes(ESC, 0x4A, 0x00)))
        return self

    # ---- 高层排版辅助 ----
    def separator(self, ch: Optional[str] = None, width: Optional[int] = None) -> "EscpBuilder":
        ch = ch or "-"
        width = int(width) if width is not None else self.line_width
        cw = disp_width(ch) or 1
        n = max(1, width // cw)
        return self._push_text_line(ch * n)

    def kv(self, key: Any, value: Any, width: Optional[int] = None) -> "EscpBuilder":
        """键值对齐行：左对齐键 + 右对齐值。"""
        width = int(width) if width is not None else self.line_width
        k = "" if key is None else str(key)
        v = "" if value is None else str(value)
        kw, vw = disp_width(k), disp_width(v)
        if kw + vw <= width:
            gap = width - kw - vw
            return self._push_text_line(k + " " * gap + v)
        return self._push_text_line(k + "  " + truncate(v, width - kw - 2))

    def table_row(self, cols: List[Dict[str, Any]]) -> "EscpBuilder":
        """多列对齐行。cols=[{text, align, width}, ...]"""
        cells = []
        for c in cols:
            w = int(c.get("width", 10))
            t = truncate(c.get("text", ""), w)
            align = c.get("align")
            if align == "right":
                cells.append(pad_left(t, w))
            elif align == "center":
                tw = disp_width(t)
                left = (w - tw) // 2
                cells.append(" " * left + t + " " * (w - tw - left))
            else:
                cells.append(pad_right(t, w))
        return self._push_text_line(" ".join(cells))

    def title(self, t: Any) -> "EscpBuilder":
        """居中 + 倍高倍宽 + 粗体标题。"""
        self.align("center")
        self.bold(True)
        self.double_height(True).double_width(True)
        self._push_text_line("" if t is None else str(t))
        self.normal_size()
        self.bold(False)
        self.align("left")
        return self

    # ============== 输出 ==============
    def to_script(self) -> List[str]:
        """序列化成「脚本行列表」，交给 raw_printer 发送。

        格式与 dprinter-web 一致：
          - raw 行：'@@RAW@@' + latin1 解码的控制字节
          - text 行：原样 UTF-8 文本
        """
        lines: List[str] = []
        for kind, data in self.parts:
            if kind == "raw":
                lines.append("@@RAW@@" + data.decode("latin1"))
            else:
                lines.append(data)
        return lines

    def get_preview(self) -> List[Dict[str, Any]]:
        return list(self.preview)


def demo() -> EscpBuilder:
    """自检：python -c "from escp import demo; demo()" 打印 hex 与预览。"""
    b = (
        EscpBuilder()
        .init()
        .title("粮食入库单")
        .separator("=")
        .kv("单号", "RK20260617-001")
        .kv("日期", "2026-06-17")
        .separator()
        .table_row([
            {"text": "货品", "align": "left", "width": 16},
            {"text": "重量(kg)", "align": "right", "width": 12},
            {"text": "单价", "align": "right", "width": 10},
            {"text": "金额", "align": "right", "width": 10},
        ])
        .table_row([
            {"text": "小麦(一等)", "width": 16},
            {"text": "1500.5", "align": "right", "width": 12},
            {"text": "2.80", "align": "right", "width": 10},
            {"text": "4201.40", "align": "right", "width": 10},
        ])
        .separator()
        .feed(2)
        .feed_to_tear()
    )
    script = b.to_script()
    print("===== ESC/P SCRIPT =====")
    print("\n".join(script))
    raw_blob = b"".join(
        line[7:].encode("latin1") if line.startswith("@@RAW@@") else line.encode("gb18030") + b"\n"
        for line in script
    )
    print("\n===== HEX (前 128 字节) =====")
    print(" ".join("%02X" % c for c in raw_blob[:128]))
    print("\n===== PREVIEW MODEL =====")
    for ln in b.get_preview():
        tag = (ln.get("align", "l")[0].upper()) + ("B" if ln.get("bold") else " ") + ("W" if ln.get("dw") else " ")
        print("[%s] %s" % (tag, ln.get("text") or "(空行)"))
    return b


if __name__ == "__main__":
    demo()
