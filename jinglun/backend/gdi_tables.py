"""gdi_tables.py — 表格数据模型 + 布局算法（纯数学，不碰 GDI）

与 ESC/P 的关系：完全独立。这里产出的 Table 模型喂给 gdi_docs.py 渲染，
不走 escp.EscpBuilder，不影响现有字符打印。

数据模型：
  Cell(text, align, bold, colspan, rowspan, font_size)
  Row(cells, header)                header=True 的行加粗
  Table(title, meta, rows, footer, col_ratios)

布局算法（layout）：
  输入：纸宽像素、DPI、列比例、字号
  输出：每个单元格的像素矩形 + 文字属性（LaidCell / LaidTable）
  不依赖打印机 —— dryRun 也能算（用假 DPI）。

预览生成（to_preview）：
  产出与 escp.get_preview() 同结构的行对象列表，前端 renderPreview 零改动复用。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


# ============================================================
# 数据模型
# ============================================================
class Cell:
    """表格单元格。"""

    def __init__(
        self,
        text: str = "",
        align: str = "left",  # left / center / right
        bold: bool = False,
        colspan: int = 1,
        rowspan: int = 1,
        font_size: Optional[float] = None,
    ) -> None:
        self.text = "" if text is None else str(text)
        self.align = align
        self.bold = bold
        self.colspan = max(1, int(colspan))
        self.rowspan = max(1, int(rowspan))
        self.font_size = font_size


class Row:
    """表格行。"""

    def __init__(self, cells: List[Cell], header: bool = False) -> None:
        self.cells = list(cells)
        self.header = header


class Table:
    """整张表格单据。"""

    def __init__(
        self,
        title: str = "",
        meta: Optional[List[Tuple[str, str]]] = None,  # 表头信息行 [(k,v)]
        rows: Optional[List[Row]] = None,
        footer: Optional[List[Row]] = None,  # 签字栏等
        col_ratios: Optional[List[float]] = None,  # 列宽比例
        company_name: str = "",
    ) -> None:
        self.title = title
        self.company_name = company_name
        self.meta = list(meta) if meta else []
        self.rows = list(rows) if rows else []
        self.footer = list(footer) if footer else []
        self.col_ratios = list(col_ratios) if col_ratios else [1.0]


# ============================================================
# 布局结果（带像素坐标）
# ============================================================
class LaidCell:
    """布局后的单元格：含像素矩形 + 文字属性。"""

    def __init__(
        self,
        text: str,
        rect: Tuple[int, int, int, int],
        align: str = "left",
        bold: bool = False,
        font_size: Optional[float] = None,
        kind: str = "cell",  # cell / title / meta_k / meta_v
    ) -> None:
        self.text = text
        self.rect = rect  # (left, top, right, bottom)
        self.align = align
        self.bold = bold
        self.font_size = font_size
        self.kind = kind


class LaidTable:
    """布局后的整张表：含标题矩形、meta、数据行、签字栏，所有坐标都是像素。"""

    def __init__(self) -> None:
        self.width: int = 0  # 整表像素宽
        self.height: int = 0  # 整表像素高
        self.title_cells: List[LaidCell] = []
        self.meta_cells: List[LaidCell] = []
        self.grid_cells: List[List[LaidCell]] = []  # 每行一组
        self.footer_cells: List[List[LaidCell]] = []
        # 所有"该画框"的矩形（标题外框、表格格子的边框）
        self.rects: List[Tuple[int, int, int, int]] = []
        # 所有"该画分隔线"的线段（非外框的内部分隔，可选）
        self.lines: List[Tuple[int, int, int, int]] = []
        self.font_default: float = 9.0
        self.font_title: float = 14.0
        self.font_bold: bool = True


# ============================================================
# 布局算法
# ============================================================
def _pt_to_px(pt: float, dpi: int) -> int:
    """磅 → 像素。"""
    return int(round(pt * dpi / 72.0))


def _row_height(cells_text: List[str], font_size: float, dpi: int, padding: int = 4) -> int:
    """估算行高：按字号 + 内边距。简单按单行算（中文票据字段一般不换行）。"""
    return _pt_to_px(font_size, dpi) + padding * 2


def layout(
    table: Table,
    dpi: int = 180,
    page_w_mm: float = 75.0,
    margin_mm: float = 3.0,
    font_default: float = 9.0,
    font_title: float = 14.0,
) -> LaidTable:
    """把 Table 模型布局成像素坐标的 LaidTable。

    page_w_mm: 纸张物理宽度（毫米），如 75 = 7.5cm。
    margin_mm: 左右边距（毫米）。
    dpi: 假想 DPI（dryRun 用 180，真打用打印机实际 DPI）。
    """
    laid = LaidTable()
    laid.font_default = font_default
    laid.font_title = font_title

    # 整表可用宽度（像素）
    page_w_px = int(round(page_w_mm * dpi / 25.4))
    margin_px = int(round(margin_mm * dpi / 25.4))
    content_w = page_w_px - margin_px * 2
    laid.width = content_w

    cur_y = margin_px

    # ---- 标题区（居中、加粗、大字）----
    if table.title:
        title_h = _pt_to_px(font_title, dpi) + 8
        # 标题占满整宽
        title_rect = (margin_px, cur_y, margin_px + content_w, cur_y + title_h)
        laid.title_cells.append(LaidCell(
            text=table.title, rect=title_rect,
            align="center", bold=True, font_size=font_title, kind="title",
        ))
        laid.rects.append(title_rect)
        cur_y += title_h

    # 公司名（标题下一行，居中小字）
    if table.company_name:
        ch = _pt_to_px(font_default, dpi) + 4
        cr = (margin_px, cur_y, margin_px + content_w, cur_y + ch)
        laid.title_cells.append(LaidCell(
            text=table.company_name, rect=cr,
            align="center", bold=False, font_size=font_default, kind="title",
        ))
        cur_y += ch

    # ---- meta 区（表头信息：左 k 右 v，两列分布）----
    if table.meta:
        # meta 用两列：k 占 30%，v 占 70%
        col_k = int(content_w * 0.30)
        col_v = content_w - col_k
        for k, v in table.meta:
            rh = _row_height([k, v], font_default, dpi)
            k_rect = (margin_px, cur_y, margin_px + col_k, cur_y + rh)
            v_rect = (margin_px + col_k, cur_y, margin_px + content_w, cur_y + rh)
            laid.meta_cells.append(LaidCell(
                text=str(k), rect=k_rect, align="left", bold=True,
                font_size=font_default, kind="meta_k",
            ))
            laid.meta_cells.append(LaidCell(
                text=str(v), rect=v_rect, align="left", bold=False,
                font_size=font_default, kind="meta_v",
            ))
            # k 格和 v 格都画框
            laid.rects.append(k_rect)
            laid.rects.append(v_rect)
            cur_y += rh

    # ---- 数据网格区 ----
    if table.rows:
        n_cols = table.col_ratios and len(table.col_ratios) or 1
        ratios = table.col_ratios if table.col_ratios else [1.0]
        ratio_sum = float(sum(ratios)) or 1.0
        col_widths = [int(content_w * r / ratio_sum) for r in ratios]
        # 修正最后一列凑整
        diff = content_w - sum(col_widths)
        if col_widths:
            col_widths[-1] += diff

        for row in table.rows:
            rh = _row_height(
                [c.text for c in row.cells], font_default, dpi,
            )
            # 处理 colspan：合并列宽
            x = margin_px
            col_idx = 0
            row_cells: List[LaidCell] = []
            for cell in row.cells:
                span = min(cell.colspan, n_cols - col_idx) or 1
                cw = sum(col_widths[col_idx:col_idx + span])
                rect = (x, cur_y, x + cw, cur_y + rh)
                bold = cell.bold or row.header
                row_cells.append(LaidCell(
                    text=cell.text, rect=rect,
                    align=cell.align, bold=bold,
                    font_size=cell.font_size or font_default,
                    kind="cell",
                ))
                laid.rects.append(rect)
                x += cw
                col_idx += span
            laid.grid_cells.append(row_cells)
            cur_y += rh

    # ---- footer 区（签字栏，复用网格画法）----
    if table.footer:
        n_cols = max(len(r.cells) for r in table.footer) if table.footer else 1
        ratios = [1.0] * n_cols
        col_widths = [int(content_w * r / n_cols) for r in ratios]
        diff = content_w - sum(col_widths)
        if col_widths:
            col_widths[-1] += diff
        for row in table.footer:
            rh = _pt_to_px(font_default, dpi) + 12  # 签字栏高一点
            x = margin_px
            row_cells: List[LaidCell] = []
            for i, cell in enumerate(row.cells):
                cw = col_widths[i] if i < len(col_widths) else col_widths[-1]
                rect = (x, cur_y, x + cw, cur_y + rh)
                row_cells.append(LaidCell(
                    text=cell.text, rect=rect,
                    align=cell.align, bold=cell.bold,
                    font_size=cell.font_size or font_default, kind="cell",
                ))
                laid.rects.append(rect)
                x += cw
            laid.footer_cells.append(row_cells)
            cur_y += rh

    laid.height = cur_y
    return laid


# ============================================================
# 预览生成（产出与 escp.get_preview() 同结构的行对象）
# ============================================================
def _align_map(a: str) -> str:
    return {"left": "left", "center": "center", "right": "right"}.get(a, "left")


def _disp_w(text: Any) -> int:
    """计算显示宽度：中文/CJK=2，ASCII=1。

    GDI 预览对齐用（与 box_tables.box_width 一致逻辑，但不把制表符算 2 列——
    GDI 预览不含制表符画框，只有文本和 │ 分隔符，│ 在等宽字体里是 1 列）。
    """
    if text is None:
        return 0
    s = str(text)
    w = 0
    for ch in s:
        c = ord(ch)
        if (
            0x2E80 <= c <= 0xA4CF     # 中日韩部首/笔划
            or 0xAC00 <= c <= 0xD7A3     # 韩文音节
            or 0xF900 <= c <= 0xFAFF     # 兼容汉字
            or 0xFE30 <= c <= 0xFE4F     # CJK 兼容形式
            or 0xFF00 <= c <= 0xFF60     # 全角符号/字母
            or 0xFFE0 <= c <= 0xFFE6     # 全角货币
            or 0x3000 <= c <= 0x303F     # CJK 标点
            or 0x3040 <= c <= 0x33FF     # 假名/注音/CJK 符号
        ):
            w += 2
        else:
            w += 1
    return w


def _pad_cell(text: Any, width: int, align: str = "left") -> str:
    """按 _disp_w 把 text 填充/截断到 width 列。"""
    s = "" if text is None else str(text)
    tw = _disp_w(s)
    if tw >= width:
        # 超宽则截断（按字符逐个累加，避免半个中文字符）
        out = ""
        w = 0
        for ch in s:
            cw = _disp_w(ch)
            if w + cw > width:
                break
            out += ch
            w += cw
        return out
    pad = width - tw
    if align == "center":
        left = pad // 2
        return " " * left + s + " " * (pad - left)
    if align == "right":
        return " " * pad + s
    return s + " " * pad


def to_preview(table: Table) -> List[Dict[str, Any]]:
    """生成文本近似预览（用 │ 分隔的网格），结构与 escp.get_preview() 一致。

    前端 renderPreview 接收 [{text, align, bold, dw, dh}]，这里照此产出。
    用等宽字体下的列对齐模拟 GDI 实线网格（实际打印是 GDI 像素矩形）。

    列对齐原理：扫描每个逻辑列在所有行(rows+footer)中的最大显示宽度
    （中文=2、ASCII=1），每列统一 pad 到该宽度，│ 就对齐了。
    横线和签字栏都按"网格总宽"拉满，不再写死 40。
    """
    lines: List[Dict[str, Any]] = []

    def push(text: str, align: str = "left", bold: bool = False, dw: bool = False) -> None:
        lines.append({"text": text, "align": align, "bold": bold, "dw": dw, "dh": dw})

    # 标题
    if table.title:
        push(table.title, "center", True, True)
    if table.company_name:
        push(table.company_name, "center", False)

    n_cols = len(table.col_ratios) if table.col_ratios else 1

    # ---- 第一步：扫描 rows + footer 所有行，算出统一的列宽数组 col_max ----
    # 这样数据行和签字栏共用同一套列宽，横线贯穿全表宽度一致。
    col_max = [2] * n_cols
    all_rows = list(table.rows) + list(table.footer)
    for row in all_rows:
        col_idx = 0
        for cell in row.cells:
            if col_idx >= n_cols:
                break
            span = min(cell.colspan, n_cols - col_idx) or 1
            w = _disp_w(cell.text)
            if span == 1:
                if w > col_max[col_idx]:
                    col_max[col_idx] = w
            else:
                # colspan>1：内容宽度与"所跨列已有宽度和"比较，不足则加到末列撑开
                merged_w = sum(col_max[col_idx:col_idx + span])
                if w > merged_w:
                    col_max[col_idx + span - 1] += w - merged_w
            col_idx += span

    # 网格总宽 = 各列宽之和 + (n_cols+1) 个 │（每个 1 列）
    grid_total_w = sum(col_max) + n_cols + 1

    def hline() -> str:
        """横线拉满到网格总宽。"""
        return "─" * grid_total_w

    def render_grid(rows_data: List[Row]) -> None:
        """按 col_max 渲染一组行。colspan 单元格 pad 到合并列宽总和（拉满）。

        末尾 pad 到 grid_total_w：colspan 行的 │ 比数据行少（合并格内无线），
        补尾随空格让所有行视觉等宽，与横线对齐。
        """
        for row in rows_data:
            parts: List[str] = []
            col_idx = 0
            for cell in row.cells:
                if col_idx >= n_cols:
                    break
                span = min(cell.colspan, n_cols - col_idx) or 1
                # colspan 单元格宽度 = 所跨列宽总和（拉满，不留半格空）
                cell_w = sum(col_max[col_idx:col_idx + span])
                parts.append(_pad_cell(cell.text, cell_w, cell.align))
                col_idx += span
            # 行末没填满所有列时补齐（防 │ 数量不一致）
            while col_idx < n_cols:
                parts.append(_pad_cell("", col_max[col_idx]))
                col_idx += 1
            line_text = "│" + "│".join(parts) + "│"
            # 尾随空格补到网格总宽（colspan 行 │ 少，补齐后视觉与横线等宽）
            gap = grid_total_w - _disp_w(line_text)
            if gap > 0:
                line_text += " " * gap
            push(line_text, "left", row.header)

    # meta（表头信息：单行 k + v，左对齐，不画框）
    if table.meta:
        push(hline(), "left", False)
        for k, v in table.meta:
            push("%s  %s" % (k, v), "left", False)

    # 数据网格
    if table.rows:
        push(hline(), "left", False)
        render_grid(table.rows)

    # footer（签字栏，含 colspan）——用同一套 col_max，colspan 自然拉满
    if table.footer:
        push(hline(), "left", False)
        render_grid(table.footer)

    push(hline(), "left", False)
    push("[ GDI 图形表格 · 实线边框预览（实际打印为 GDI 像素实线网格）]", "center", False)
    return lines


# ============================================================
# entry → Table 组装（业务字段映射）
# ============================================================
def _s(v: Any) -> str:
    return "" if v is None or v == "" else str(v)


def build_grain_in_table(entry: Dict[str, Any], wide: bool = False) -> Table:
    """粮食入库 → Table（字段映射对齐 print_docs.build_grain_in_fields，但产出 Table 模型）。

    wide=False（默认）：4 列网格（2 组键值/行），适配窄纸（7.5~9cm）。
    wide=True：6 列网格（3 组键值/行），适配 25cm 宽幅横版纸，一行排更多字段更省纸。
    两种布局字段内容完全一致，只是分行方式不同。
    """
    amount = entry.get("adjustedAmount")
    if amount in (None, "", 0, "0"):
        amount = entry.get("originalAmount")
    id_card = _s(entry.get("farmerIdCardSnap")) or _s(entry.get("farmerIdCard")) or "---"
    bank_card = _s(entry.get("farmerBankAccountSnap")) or _s(entry.get("bankAccount")) or _s(entry.get("farmerBankAccount")) or "---"
    farmer_name = _s(entry.get("farmerName")) or "现场散单"
    farmer_phone = _s(entry.get("farmerPhone")) or _s(entry.get("farmerPhoneSnap"))
    if farmer_phone and farmer_name != "现场散单":
        farmer_name = "%s(%s)" % (farmer_name, farmer_phone)

    if wide:
        # 宽幅 6 列：3 组键值/行（label|value|label|value|label|value）
        rows = [
            Row([Cell("农户", bold=True), Cell(farmer_name),
                 Cell("身份证", bold=True), Cell(id_card),
                 Cell("品种", bold=True),
                 Cell(_s(entry.get("grainNameSnap")) or _s(entry.get("grainType")))]),
            Row([Cell("银行卡", bold=True), Cell(bank_card),
                 Cell("仓位", bold=True),
                 Cell(_s(entry.get("wareareaNameSnap")) or _s(entry.get("wareareaName"))),
                 Cell("车牌号", bold=True),
                 Cell(_s(entry.get("driverPlateSnap")) or _s(entry.get("driverPlate")))]),
            Row([Cell("毛重(kg)", bold=True), Cell(_s(entry.get("grossWeight"))),
                 Cell("皮重(kg)", bold=True), Cell(_s(entry.get("tareWeight"))),
                 Cell("扣重(kg)", bold=True), Cell(_s(entry.get("deductWeight")) or "0")]),
            Row([Cell("净重(kg)", bold=True), Cell(_s(entry.get("netWeight"))),
                 Cell("水分", bold=True), Cell(_s(entry.get("moisture")) or "-"),
                 Cell("杂质", bold=True), Cell(_s(entry.get("impurity")) or "-")]),
            Row([Cell("单价(元/kg)", bold=True), Cell(_s(entry.get("unitPrice"))),
                 Cell("重金属Cd", bold=True),
                 Cell("%s mg/kg" % (_s(entry.get("heavyMetalCd")) or "---")),
                 Cell("结算金额", bold=True), Cell("￥" + _s(amount))]),
            Row([Cell("库管员", bold=True), Cell(_s(entry.get("createBy"))), Cell("", colspan=4)]),
        ]
        col_ratios = [1.0, 1.6, 1.0, 1.6, 1.0, 1.6]
    else:
        # 窄版 4 列：2 组键值/行（原有布局，不动）
        rows = [
            Row([Cell("农户", bold=True), Cell(farmer_name), Cell("身份证", bold=True), Cell(id_card)]),
            Row([Cell("银行卡", bold=True), Cell(bank_card), Cell("品种", bold=True),
                 Cell(_s(entry.get("grainNameSnap")) or _s(entry.get("grainType")))]),
            Row([Cell("仓位", bold=True),
                 Cell(_s(entry.get("wareareaNameSnap")) or _s(entry.get("wareareaName"))),
                 Cell("车牌号", bold=True),
                 Cell(_s(entry.get("driverPlateSnap")) or _s(entry.get("driverPlate")))]),
            Row([Cell("毛重(kg)", bold=True), Cell(_s(entry.get("grossWeight"))),
                 Cell("皮重(kg)", bold=True), Cell(_s(entry.get("tareWeight")))]),
            Row([Cell("扣重(kg)", bold=True), Cell(_s(entry.get("deductWeight")) or "0"),
                 Cell("净重(kg)", bold=True), Cell(_s(entry.get("netWeight")))]),
            Row([Cell("水分/杂质", bold=True),
                 Cell("%s%% / %s%%" % (_s(entry.get("moisture")) or "-", _s(entry.get("impurity")) or "-")),
                 Cell("单价(元/kg)", bold=True), Cell(_s(entry.get("unitPrice")))]),
            Row([Cell("重金属Cd", bold=True),
                 Cell("%s mg/kg" % (_s(entry.get("heavyMetalCd")) or "---")),
                 Cell("结算金额", bold=True), Cell("￥" + _s(amount))]),
            Row([Cell("库管员", bold=True), Cell(_s(entry.get("createBy"))), Cell("", colspan=2)]),
        ]
        col_ratios = [1.0, 1.6, 1.0, 1.6]

    meta: List[Tuple[str, str]] = []
    no = _s(entry.get("entryNo"))
    date = _s(entry.get("printDate"))
    if no:
        meta.append(("单号", no))
    if date:
        meta.append(("日期", date))

    # footer colspan 按列数定：窄版 4 列各占一半(colspan=2)，宽幅 6 列各占一半(colspan=3)
    sign_colspan = 3 if wide else 2
    footer = [
        Row([Cell("经办人签字：____________", colspan=sign_colspan),
             Cell("客户签字：____________", colspan=sign_colspan)]),
    ]

    return Table(
        title="粮食入库结算单",
        company_name=_s(entry.get("factoryName")) or "烘干厂",
        meta=meta,
        rows=rows,
        footer=footer,
        col_ratios=col_ratios,
    )


def build_grain_out_table(entry: Dict[str, Any], wide: bool = False) -> Table:
    """粮食出库 → Table。

    wide=False（默认）：4 列网格（2 组键值/行），适配窄纸（7.5~9cm）。
    wide=True：6 列网格（3 组键值/行），适配 25cm 宽幅横版纸。
    """
    amount = entry.get("adjustedAmount")
    if amount in (None, "", 0, "0"):
        amount = entry.get("originalAmount")
    id_card = _s(entry.get("customerIdCardSnap")) or "---"
    bank_card = _s(entry.get("customerBankAccountSnap")) or _s(entry.get("bankAccount")) or "---"
    customer_name = _s(entry.get("customerNameSnap")) or "现场散单"
    customer_phone = _s(entry.get("customerPhoneSnap"))
    if customer_phone and customer_name != "现场散单":
        customer_name = "%s(%s)" % (customer_name, customer_phone)

    if wide:
        # 宽幅 6 列：3 组键值/行
        rows = [
            Row([Cell("客户", bold=True), Cell(customer_name),
                 Cell("身份证", bold=True), Cell(id_card),
                 Cell("品种", bold=True), Cell(_s(entry.get("grainNameSnap")))]),
            Row([Cell("银行卡", bold=True), Cell(bank_card),
                 Cell("仓位", bold=True), Cell(_s(entry.get("wareareaNameSnap"))),
                 Cell("车牌号", bold=True), Cell(_s(entry.get("driverPlateSnap")))]),
            Row([Cell("毛重(kg)", bold=True), Cell(_s(entry.get("grossWeight"))),
                 Cell("皮重(kg)", bold=True), Cell(_s(entry.get("tareWeight"))),
                 Cell("扣重(kg)", bold=True), Cell(_s(entry.get("deductWeight")) or "0")]),
            Row([Cell("净重(kg)", bold=True), Cell(_s(entry.get("netWeight"))),
                 Cell("单价(元/kg)", bold=True), Cell(_s(entry.get("unitPrice"))),
                 Cell("应收金额", bold=True), Cell("￥" + _s(amount))]),
            Row([Cell("重金属Cd", bold=True),
                 Cell("%s mg/kg" % (_s(entry.get("heavyMetalCd")) or "---")),
                 Cell("库管员", bold=True), Cell(_s(entry.get("createBy"))),
                 Cell("", colspan=2)]),
        ]
        col_ratios = [1.0, 1.6, 1.0, 1.6, 1.0, 1.6]
    else:
        # 窄版 4 列：2 组键值/行（原有布局，不动）
        rows = [
            Row([Cell("客户", bold=True), Cell(customer_name), Cell("身份证", bold=True), Cell(id_card)]),
            Row([Cell("银行卡", bold=True), Cell(bank_card), Cell("品种", bold=True),
                 Cell(_s(entry.get("grainNameSnap")))]),
            Row([Cell("仓位", bold=True), Cell(_s(entry.get("wareareaNameSnap"))),
                 Cell("车牌号", bold=True), Cell(_s(entry.get("driverPlateSnap")))]),
            Row([Cell("毛重(kg)", bold=True), Cell(_s(entry.get("grossWeight"))),
                 Cell("皮重(kg)", bold=True), Cell(_s(entry.get("tareWeight")))]),
            Row([Cell("扣重(kg)", bold=True), Cell(_s(entry.get("deductWeight")) or "0"),
                 Cell("净重(kg)", bold=True), Cell(_s(entry.get("netWeight")))]),
            Row([Cell("单价(元/kg)", bold=True), Cell(_s(entry.get("unitPrice"))),
                 Cell("应收金额", bold=True), Cell("￥" + _s(amount))]),
            Row([Cell("重金属Cd", bold=True),
                 Cell("%s mg/kg" % (_s(entry.get("heavyMetalCd")) or "---")),
                 Cell("库管员", bold=True), Cell(_s(entry.get("createBy")))]),
        ]
        col_ratios = [1.0, 1.6, 1.0, 1.6]

    meta: List[Tuple[str, str]] = []
    no = _s(entry.get("exitNo"))
    date = _s(entry.get("printDate"))
    if no:
        meta.append(("单号", no))
    if date:
        meta.append(("日期", date))

    # footer colspan 按列数定：窄版 4 列各占一半(colspan=2)，宽幅 6 列各占一半(colspan=3)
    sign_colspan = 3 if wide else 2
    footer = [
        Row([Cell("经办人签字：____________", colspan=sign_colspan),
             Cell("客户签字：____________", colspan=sign_colspan)]),
    ]

    return Table(
        title="粮食出库结算单",
        company_name=_s(entry.get("factoryName")) or "烘干厂",
        meta=meta,
        rows=rows,
        footer=footer,
        col_ratios=col_ratios,
    )


# ============================================================
# 纸张预设
# ============================================================
PAPER_PRESETS = [
    {"key": "75x100", "name": "7.5cm × 10cm（连续三联纸）", "width_mm": 75.0, "length_mm": 100.0},
    {"key": "75x140", "name": "7.5cm × 14cm（连续三联纸）", "width_mm": 75.0, "length_mm": 140.0},
    {"key": "90x140", "name": "9cm × 14cm（连续三联纸）", "width_mm": 90.0, "length_mm": 140.0},
    # 宽幅横版：25cm(宽) × 14cm(走纸方向)。纸宽 250mm 对应 ~96 半角列，
    # GDI 按 6 列网格布局（3 组键值/行）更舒展。与 ESC/P 的 GENERIC_WIDE_96 型号配套。
    {"key": "250x140", "name": "25cm × 14cm（宽幅横版三联纸）", "width_mm": 250.0, "length_mm": 140.0},
    {"key": "A4", "name": "A4（210 × 297mm）", "width_mm": 210.0, "length_mm": 297.0},
    {"key": "default", "name": "驱动默认（不指定）", "width_mm": 0, "length_mm": 0},
]


def resolve_paper(paper_key: Optional[str]) -> Optional[Tuple[float, float]]:
    """纸张 key → (width_mm, length_mm)。key 为 None 或 default 返回 None。"""
    if not paper_key or paper_key == "default":
        return None
    for p in PAPER_PRESETS:
        if p["key"] == paper_key:
            if p["width_mm"] <= 0:
                return None
            return (p["width_mm"], p["length_mm"])
    return None


# ============================================================
# 分发
# ============================================================
TABLE_BUILDERS = {
    "grain_in": build_grain_in_table,
    "grain_out": build_grain_out_table,
}


def build_table(doc_type: str, entry: Dict[str, Any], wide: bool = False) -> Table:
    """分发入口：doc_type → 对应表格组装函数。未知类型 raise ValueError。

    wide 透传给 build_grain_*_table：True 走 6 列宽幅布局，False 走 4 列窄版。
    """
    if doc_type not in TABLE_BUILDERS:
        raise ValueError("未知单据类型: %s（GDI 表格支持 %s）" % (doc_type, " / ".join(TABLE_BUILDERS.keys())))
    return TABLE_BUILDERS[doc_type](entry, wide=wide)


if __name__ == "__main__":
    # 自检：布局 + 预览（不碰打印机）。窄版 4 列 + 宽幅 6 列两种都验证。
    entry = {
        "entryNo": "RK260706001",
        "farmerName": "张三",
        "farmerPhone": "13800000001",
        "grainNameSnap": "小麦(一等)",
        "wareareaNameSnap": "1号仓",
        "grossWeight": 1510.5,
        "tareWeight": 9.5,
        "deductWeight": 0.5,
        "netWeight": 1500.5,
        "moisture": 13.2,
        "impurity": 1.0,
        "unitPrice": 2.80,
        "adjustedAmount": 4201.40,
        "createBy": "库管员A",
        "factoryName": "某某粮油烘干厂",
        "printDate": "2026-07-06",
    }
    for wide, paper_w, label in [(False, 75.0, "窄版4列 7.5cm"), (True, 250.0, "宽幅6列 25cm")]:
        t = build_table("grain_in", entry, wide=wide)
        laid = layout(t, dpi=180, page_w_mm=paper_w)
        print("===== %s：布局 %dx%d px, %d 个格子框, %d 列 =====" %
              (label, laid.width, laid.height, len(laid.rects), len(t.col_ratios)))
        for ln in to_preview(t):
            print("  [%s] %s" % (ln.get("align", "l")[0].upper(), ln.get("text") or "(空)"))
        print()
