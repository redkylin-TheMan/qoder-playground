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


def to_preview(table: Table) -> List[Dict[str, Any]]:
    """生成文本近似预览（用 +—+ 表示网格），结构与 escp.get_preview() 一致。

    前端 renderPreview 接收 [{text, align, bold, dw, dh}]，这里照此产出。
    网格用 ASCII 近似（实际打印是 GDI 实线）。
    """
    lines: List[Dict[str, Any]] = []

    def push(text: str, align: str = "left", bold: bool = False, dw: bool = False) -> None:
        lines.append({"text": text, "align": align, "bold": bold, "dw": dw, "dh": dw})

    # 标题
    if table.title:
        push(table.title, "center", True, True)
    if table.company_name:
        push(table.company_name, "center", False)

    # 横向分隔（用 +---+ 表示）
    def hline(cols: int, label: str = "") -> str:
        if label:
            return "─" * 40
        return "─" * 40

    # meta
    if table.meta:
        push(hline(1))
        for k, v in table.meta:
            push("%s  %s" % (k, v), "left", False)

    # 数据网格（用表格近似）
    if table.rows:
        push(hline(1))
        for row in table.rows:
            texts = [c.text for c in row.cells]
            push(" │ ".join(texts), "left", row.header)

    # footer
    if table.footer:
        push(hline(1))
        for row in table.footer:
            texts = [c.text for c in row.cells]
            push(" │ ".join(texts), "left")

    push(hline(1))
    push("[ GDI 图形表格 · 实线边框预览（实际打印为实线网格）]", "center", False)
    return lines


# ============================================================
# entry → Table 组装（业务字段映射）
# ============================================================
def _s(v: Any) -> str:
    return "" if v is None or v == "" else str(v)


def build_grain_in_table(entry: Dict[str, Any]) -> Table:
    """粮食入库 → Table（字段映射对齐 print_docs.build_grain_in_fields，但产出 Table 模型）。"""
    amount = entry.get("adjustedAmount")
    if amount in (None, "", 0, "0"):
        amount = entry.get("originalAmount")
    id_card = _s(entry.get("farmerIdCardSnap")) or _s(entry.get("farmerIdCard")) or "---"
    bank_card = _s(entry.get("farmerBankAccountSnap")) or _s(entry.get("bankAccount")) or _s(entry.get("farmerBankAccount")) or "---"
    farmer_name = _s(entry.get("farmerName")) or "现场散单"
    farmer_phone = _s(entry.get("farmerPhone")) or _s(entry.get("farmerPhoneSnap"))
    if farmer_phone and farmer_name != "现场散单":
        farmer_name = "%s(%s)" % (farmer_name, farmer_phone)

    # 三列布局：标签 | 值 | （第三列容纳并排的两组）
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

    meta: List[Tuple[str, str]] = []
    no = _s(entry.get("entryNo"))
    date = _s(entry.get("printDate"))
    if no:
        meta.append(("单号", no))
    if date:
        meta.append(("日期", date))

    footer = [
        Row([Cell("经办人签字：____________", colspan=2),
             Cell("客户签字：____________", colspan=2)]),
    ]

    return Table(
        title="粮食入库结算单",
        company_name=_s(entry.get("factoryName")) or "烘干厂",
        meta=meta,
        rows=rows,
        footer=footer,
        col_ratios=[1.0, 1.6, 1.0, 1.6],
    )


def build_grain_out_table(entry: Dict[str, Any]) -> Table:
    """粮食出库 → Table。"""
    amount = entry.get("adjustedAmount")
    if amount in (None, "", 0, "0"):
        amount = entry.get("originalAmount")
    id_card = _s(entry.get("customerIdCardSnap")) or "---"
    bank_card = _s(entry.get("customerBankAccountSnap")) or _s(entry.get("bankAccount")) or "---"
    customer_name = _s(entry.get("customerNameSnap")) or "现场散单"
    customer_phone = _s(entry.get("customerPhoneSnap"))
    if customer_phone and customer_name != "现场散单":
        customer_name = "%s(%s)" % (customer_name, customer_phone)

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

    meta: List[Tuple[str, str]] = []
    no = _s(entry.get("exitNo"))
    date = _s(entry.get("printDate"))
    if no:
        meta.append(("单号", no))
    if date:
        meta.append(("日期", date))

    footer = [
        Row([Cell("经办人签字：____________", colspan=2),
             Cell("客户签字：____________", colspan=2)]),
    ]

    return Table(
        title="粮食出库结算单",
        company_name=_s(entry.get("factoryName")) or "烘干厂",
        meta=meta,
        rows=rows,
        footer=footer,
        col_ratios=[1.0, 1.6, 1.0, 1.6],
    )


# ============================================================
# 纸张预设
# ============================================================
PAPER_PRESETS = [
    {"key": "75x100", "name": "7.5cm × 10cm（连续三联纸）", "width_mm": 75.0, "length_mm": 100.0},
    {"key": "75x140", "name": "7.5cm × 14cm（连续三联纸）", "width_mm": 75.0, "length_mm": 140.0},
    {"key": "90x140", "name": "9cm × 14cm（连续三联纸）", "width_mm": 90.0, "length_mm": 140.0},
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


def build_table(doc_type: str, entry: Dict[str, Any]) -> Table:
    """分发入口：doc_type → 对应表格组装函数。未知类型 raise ValueError。"""
    if doc_type not in TABLE_BUILDERS:
        raise ValueError("未知单据类型: %s（GDI 表格支持 %s）" % (doc_type, " / ".join(TABLE_BUILDERS.keys())))
    return TABLE_BUILDERS[doc_type](entry)


if __name__ == "__main__":
    # 自检：布局 + 预览（不碰打印机）
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
    t = build_table("grain_in", entry)
    laid = layout(t, dpi=180, page_w_mm=75.0)
    print("布局: %dx%d px, %d 个格子框" % (laid.width, laid.height, len(laid.rects)))
    print("--- 预览 ---")
    for ln in to_preview(t):
        print("  [%s] %s" % (ln.get("align", "l")[0].upper(), ln.get("text") or "(空)"))
