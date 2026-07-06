"""box_tables.py — 用制表符（box-drawing）模拟表格打印

与现有三种打印方式的关系：
  - escp/print_docs/documents ：ESC/P 字符打印（无框线，纯文本键值对）
  - gdi_*                     ：GDI 图形渲染（实线边框，需驱动）
  - box_*（本模块）           ：制表符模拟表格（┌─┐│└┘，走 ESC/P 通道，无需驱动）

三者完全独立，互不影响。

⚠️ 对齐核心难点：
  制表符 U+2500-U+257F 在 escp.disp_width 里被算成 1 列（半角），但针打 GB18030
  字体实际渲染为全角 2 列。所以本模块用自己的 box_width()（制表符=2、中文=2、ASCII=1），
  不依赖 escp.disp_width——否则预览和实际打印都会错位。

  为保证全角制表符与全角中文严格对齐，所有列宽凑成偶数（分隔线 ─ 每个 2 列，
  N 个 ─ 恰好填满偶数列宽，零残差）。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple


# ============================================================
# 宽度计算（独立于 escp.disp_width —— 制表符必须算 2 列）
# ============================================================
def box_width(text: Any) -> int:
    """计算显示宽度：制表符=2、中文=2、ASCII=1。"""
    if text is None:
        return 0
    s = str(text)
    w = 0
    for ch in s:
        c = ord(ch)
        if (
            0x2500 <= c <= 0x257F        # Box Drawing 制表符（必须算全角）
            or 0x2E80 <= c <= 0xA4CF     # 中日韩部首/笔划
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


def _even_up(n: int) -> int:
    """凑成偶数（制表符对齐要求列宽为偶数）。"""
    return n if n % 2 == 0 else n + 1


def _pad(text: str, width: int, align: str) -> str:
    """按 box_width 把 text 填充到 width 列。"""
    s = "" if text is None else str(text)
    tw = box_width(s)
    if tw >= width:
        return s
    pad = width - tw
    if align == "center":
        left = pad // 2
        return " " * left + s + " " * (pad - left)
    if align == "right":
        return " " * pad + s
    return s + " " * pad


# ============================================================
# 制表符渲染（产出文本行列表）
# ============================================================
def _truncate_to_width(text: str, width: int) -> str:
    """按 box_width 截断 text 到不超过 width 列。"""
    s = "" if text is None else str(text)
    out = ""
    w = 0
    for ch in s:
        cw = box_width(ch)
        if w + cw > width:
            break
        out += ch
        w += cw
    return out


def _separator(col_widths: List[int], left: str, mid: str, right: str) -> str:
    """生成分隔行：┌──┬──┐ / ├──┼──┤ / └──┴──┘。列宽必须为偶数。"""
    parts = [left]
    for i, w in enumerate(col_widths):
        parts.append("─" * (w // 2))  # 每个 ─ 占 2 列
        parts.append(mid if i < len(col_widths) - 1 else right)
    return "".join(parts)


def _data_line(cell_texts: List[str], aligns: List[str], col_widths: List[int]) -> str:
    """生成数据行：│ 农户 │ 张三 │ ...。超长内容先截断再 pad。"""
    parts = ["│"]
    for text, align, w in zip(cell_texts, aligns, col_widths):
        parts.append(_pad(_truncate_to_width(text, w), w, align))
        parts.append("│")
    return "".join(parts)


def render_box_table(
    title: str,
    company: str,
    meta: List[Tuple[str, str]],
    field_rows: List[List[Tuple[str, str]]],  # 每行 [(label, value), ...]
    footer_lines: List[str],
    total_width: int = 48,  # 半角列，与 escp.lineWidth 一致
    label_align: str = "left",
    value_align: str = "left",
) -> List[str]:
    """把单据数据渲染成制表符表格的文本行列表。

    布局（4 列网格：label|value|label|value）：
      ┌──────────────────────────────────┐
      │       粮食入库结算单（标题）     │
      ├──────┬────────┬──────┬──────────┤
      │ 单号 │ RK001  │ 日期 │ 2026...  │
      ├──────┼────────┼──────┼──────────┤
      │ 农户 │ 张三   │ 身份证│ ---     │
      │ ...  │        │      │          │
      ├──────┴────────┴──────┴──────────┤
      │ 经办人签字___   客户签字___      │
      └──────────────────────────────────┘

    列宽策略：扫描所有 label/value 实际宽度动态分配。
    label 优先保宽（标签截断会看不懂），value 超长则截断。
    """
    # 1. 扫描所有 label / value 的最大宽度
    all_labels: List[str] = []
    all_values: List[str] = []
    for row in field_rows:
        for k, v in row:
            all_labels.append(k)
            all_values.append(v)
    for k, v in meta:
        all_labels.append(k)
        all_values.append(v)

    label_max = max([box_width(x) for x in all_labels] + [2])
    # 2. 4 列约束：2*label_w + 2*value_w + 5*2(border) = total_width
    border_width = 5 * 2  # 4 列有 5 个 │
    half_content = (total_width - border_width) / 2  # 一组 label+value 可用宽度
    # label 优先：label_w = min(label_max, half_content 的一半)，剩余给 value
    label_w = min(label_max, int(half_content * 0.45))
    value_w = int(half_content - label_w)
    # 凑偶数（制表符对齐要求）
    col_widths = [
        _even_up(label_w),
        _even_up(value_w),
        _even_up(label_w),
        _even_up(value_w),
    ]
    # 修正最后一列凑满 total_width
    diff = total_width - border_width - sum(col_widths)
    if diff:
        col_widths[-1] = max(2, col_widths[-1] + diff)
        col_widths[-1] = _even_up(col_widths[-1])

    lines: List[str] = []

    # ---- 顶边 ----
    lines.append(_separator(col_widths, "┌", "┬", "┐"))

    # ---- 标题（跨全部列，居中）----
    full_inner = sum(col_widths) + (len(col_widths) - 1) * 2  # 含中间 │ 的宽度
    lines.append("│" + _pad(_truncate_to_width(title, full_inner), full_inner, "center") + "│")
    if company:
        lines.append("│" + _pad(_truncate_to_width(company, full_inner), full_inner, "center") + "│")

    # ---- meta（作为 4 列数据行）----
    if meta:
        lines.append(_separator(col_widths, "├", "┼", "┤"))
        meta_cells: List[Tuple[str, str]] = []
        for k, v in meta:
            meta_cells.append((k, v))
        if len(meta_cells) % 2:
            meta_cells.append(("", ""))
        for i in range(0, len(meta_cells), 2):
            pair = meta_cells[i:i + 2]
            texts = [pair[0][0], pair[0][1], pair[1][0], pair[1][1]]
            aligns = [label_align, value_align, label_align, value_align]
            lines.append(_data_line(texts, aligns, col_widths))

    # ---- 字段网格 ----
    if field_rows:
        lines.append(_separator(col_widths, "├", "┼", "┤"))
        for row in field_rows:
            cells = list(row)
            if len(cells) % 2:
                cells.append(("", ""))
            texts: List[str] = []
            aligns: List[str] = []
            for k, v in cells[:2]:
                texts.extend([k, v])
                aligns.extend([label_align, value_align])
            while len(texts) < 4:
                texts.append("")
                aligns.append(value_align)
            lines.append(_data_line(texts, aligns, col_widths))

    # ---- 签字栏（全宽单行）----
    if footer_lines:
        lines.append(_separator(col_widths, "├", "┴", "┤"))  # 合并成单列
        for fl in footer_lines:
            lines.append("│" + _pad(_truncate_to_width(fl, full_inner), full_inner, "left") + "│")

    # ---- 底边 ----
    lines.append(_separator(col_widths, "└", "─", "┘"))
    return lines


# ============================================================
# entry → 字段提取（业务字段映射）
# ============================================================
def _s(v: Any) -> str:
    return "" if v is None or v == "" else str(v)


def extract_grain_in_fields(entry: Dict[str, Any]) -> Dict[str, Any]:
    """粮食入库 entry → 单据字段（标签/值/meta/footer）。"""
    amount = entry.get("adjustedAmount")
    if amount in (None, "", 0, "0"):
        amount = entry.get("originalAmount")
    id_card = _s(entry.get("farmerIdCardSnap")) or _s(entry.get("farmerIdCard")) or "---"
    bank_card = _s(entry.get("farmerBankAccountSnap")) or _s(entry.get("bankAccount")) or _s(entry.get("farmerBankAccount")) or "---"
    farmer_name = _s(entry.get("farmerName")) or "现场散单"
    farmer_phone = _s(entry.get("farmerPhone")) or _s(entry.get("farmerPhoneSnap"))
    if farmer_phone and farmer_name != "现场散单":
        farmer_name = "%s(%s)" % (farmer_name, farmer_phone)

    field_rows = [
        [("农户", farmer_name), ("身份证", id_card)],
        [("银行卡", bank_card), ("品种", _s(entry.get("grainNameSnap")) or _s(entry.get("grainType")))],
        [("仓位", _s(entry.get("wareareaNameSnap")) or _s(entry.get("wareareaName"))), ("车牌号", _s(entry.get("driverPlateSnap")) or _s(entry.get("driverPlate")))],
        [("毛重(kg)", _s(entry.get("grossWeight"))), ("皮重(kg)", _s(entry.get("tareWeight")))],
        [("扣重(kg)", _s(entry.get("deductWeight")) or "0"), ("净重(kg)", _s(entry.get("netWeight")))],
        [("水分/杂质", "%s%% / %s%%" % (_s(entry.get("moisture")) or "-", _s(entry.get("impurity")) or "-")), ("单价(元/kg)", _s(entry.get("unitPrice")))],
        [("重金属Cd", "%s mg/kg" % (_s(entry.get("heavyMetalCd")) or "---")), ("结算金额", "￥" + _s(amount))],
        [("库管员", _s(entry.get("createBy"))), ("", "")],
    ]
    meta: List[Tuple[str, str]] = []
    no = _s(entry.get("entryNo"))
    date = _s(entry.get("printDate"))
    if no:
        meta.append(("单号", no))
    if date:
        meta.append(("日期", date))
    return {
        "title": "粮食入库结算单",
        "company": _s(entry.get("factoryName")) or "烘干厂",
        "meta": meta,
        "field_rows": field_rows,
        "footer_lines": ["经办人签字：____________    客户签字：____________"],
    }


def extract_grain_out_fields(entry: Dict[str, Any]) -> Dict[str, Any]:
    """粮食出库 entry → 单据字段。"""
    amount = entry.get("adjustedAmount")
    if amount in (None, "", 0, "0"):
        amount = entry.get("originalAmount")
    id_card = _s(entry.get("customerIdCardSnap")) or "---"
    bank_card = _s(entry.get("customerBankAccountSnap")) or _s(entry.get("bankAccount")) or "---"
    customer_name = _s(entry.get("customerNameSnap")) or "现场散单"
    customer_phone = _s(entry.get("customerPhoneSnap"))
    if customer_phone and customer_name != "现场散单":
        customer_name = "%s(%s)" % (customer_name, customer_phone)

    field_rows = [
        [("客户", customer_name), ("身份证", id_card)],
        [("银行卡", bank_card), ("品种", _s(entry.get("grainNameSnap")))],
        [("仓位", _s(entry.get("wareareaNameSnap"))), ("车牌号", _s(entry.get("driverPlateSnap")))],
        [("毛重(kg)", _s(entry.get("grossWeight"))), ("皮重(kg)", _s(entry.get("tareWeight")))],
        [("扣重(kg)", _s(entry.get("deductWeight")) or "0"), ("净重(kg)", _s(entry.get("netWeight")))],
        [("单价(元/kg)", _s(entry.get("unitPrice"))), ("应收金额", "￥" + _s(amount))],
        [("重金属Cd", "%s mg/kg" % (_s(entry.get("heavyMetalCd")) or "---")), ("库管员", _s(entry.get("createBy")))],
    ]
    meta: List[Tuple[str, str]] = []
    no = _s(entry.get("exitNo"))
    date = _s(entry.get("printDate"))
    if no:
        meta.append(("单号", no))
    if date:
        meta.append(("日期", date))
    return {
        "title": "粮食出库结算单",
        "company": _s(entry.get("factoryName")) or "烘干厂",
        "meta": meta,
        "field_rows": field_rows,
        "footer_lines": ["经办人签字：____________    客户签字：____________"],
    }


FIELD_EXTRACTORS = {
    "grain_in": extract_grain_in_fields,
    "grain_out": extract_grain_out_fields,
}


def extract_fields(doc_type: str, entry: Dict[str, Any]) -> Dict[str, Any]:
    if doc_type not in FIELD_EXTRACTORS:
        raise ValueError("未知单据类型: %s（制表符表格支持 %s）" % (doc_type, " / ".join(FIELD_EXTRACTORS.keys())))
    return FIELD_EXTRACTORS[doc_type](entry)


# ============================================================
# 预览生成（产出与 escp.get_preview() 同结构的行对象）
# ============================================================
def to_preview(lines: List[str]) -> List[Dict[str, Any]]:
    """把制表符文本行转成预览模型。标题行标 bold，其余普通。"""
    preview: List[Dict[str, Any]] = []
    for i, ln in enumerate(lines):
        # 简单判断：第 2、3 行（标题、公司名）标 bold
        is_title = 1 <= i <= 2 and ("│" in ln) and not ln.startswith("┌") and not ln.startswith("├")
        preview.append({
            "text": ln,
            "align": "left",
            "bold": bool(is_title),
            "dw": False,
            "dh": False,
        })
    return preview


if __name__ == "__main__":
    # 自检：渲染入库单制表符表格
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
    fields = extract_fields("grain_in", entry)
    lines = render_box_table(
        fields["title"], fields["company"], fields["meta"],
        fields["field_rows"], fields["footer_lines"], total_width=48,
    )
    print("制表符表格（每行 box_width 应均为 %d）：" % 48)
    for ln in lines:
        w = box_width(ln)
        mark = "✓" if w == 48 else ("✗ w=" + str(w))
        print("  %s | %s" % (mark, ln))
