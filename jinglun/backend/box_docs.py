"""box_docs.py — 制表符模拟表格（box-drawing）构建 + 发送

与现有三种打印方式的关系：
  - escp/print_docs/documents ：ESC/P 字符打印（无框线）
  - gdi_*                     ：GDI 图形渲染（实线边框，需驱动）
  - box_*（本模块）           ：制表符模拟表格（┌─┐│，走 ESC/P 通道，无需驱动）

数据流（复用 ESC/P 通道，但内容是制表符文本）：
  box_tables.render_box_table() → 文本行列表
    → box_docs.build_doc() 把文本行喂给 escp.EscpBuilder.text()
      → builder.to_script() → raw_printer.send_script()（winspool RAW 发送）

所以本模块只负责"文本行 → EscpBuilder"的拼装，发送完全复用 raw_printer，
不引入新的发送通道，与现有 ESC/P 路径安全共存。
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

import box_tables
import raw_printer
from box_tables import extract_fields, render_box_table, to_preview
from escp import EscpBuilder


# ============================================================
# 字体预设（与 ESC/P 侧对齐，制表符需要等宽全角字体才对齐）
# ============================================================
DEFAULT_FONT = {"bold": True, "font": "hei", "doubleStrike": True}


def _resolve_font(font: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    out = dict(DEFAULT_FONT)
    if font:
        for k, v in font.items():
            if v is not None:
                out[k] = v
    return out


def _resolve_total_width(model: Optional[Any]) -> int:
    """从 model 取 lineWidth；制表符表格默认 52 列（比纯文本 48 略宽，留边框空间）。"""
    if isinstance(model, dict) and model.get("lineWidth"):
        return int(model["lineWidth"])
    if isinstance(model, str) and model:
        # 查 printer_models 表（延迟 import 避免循环）
        try:
            import printer_models
            m = printer_models.get_model(model)
            if m and m.get("lineWidth"):
                return int(m["lineWidth"])
        except Exception:
            pass
    return 52


# ============================================================
# 构建：文本行 → EscpBuilder
# ============================================================
def build_doc(
    doc_type: str,
    entry: Dict[str, Any],
    font: Optional[Dict[str, Any]] = None,
    model: Optional[Any] = None,
) -> Tuple[EscpBuilder, List[Dict[str, Any]]]:
    """构建制表符表格单据。返回 (EscpBuilder, preview)。

    与 print_docs.build_doc 同名同语义，但内部用 box_tables 渲染制表符文本，
    再把每行文本喂给 EscpBuilder.text()。

    entry 缺 printDate 时补今天。
    """
    if not entry.get("printDate"):
        entry = dict(entry)
        entry["printDate"] = time.strftime("%Y-%m-%d")

    fields = extract_fields(doc_type, entry)
    total_width = _resolve_total_width(model)
    font_cfg = _resolve_font(font)

    lines = render_box_table(
        fields["title"], fields["company"], fields["meta"],
        fields["field_rows"], fields["footer_lines"],
        total_width=total_width,
        # 宽幅（total_width ≥ 90，即 96 列横版）用 6 列布局（3 组键值/行），
        # 窄版继续 4 列（2 组/行）。阈值 90 留余量，避免 82 列机 64 lineWidth 误判。
        cols_per_row=6 if total_width >= 90 else 4,
    )
    preview = to_preview(lines)

    # 用 EscpBuilder 把制表符文本行喂进去（复用 init 字体设置 + GB18030 编码）
    b = EscpBuilder({"lineWidth": total_width}).init(font_cfg)
    for ln in lines:
        b.text(ln)
    # FF 换页：对齐走纸到下一页（与 print_docs 三联单同样的走纸策略）
    b.form_feed()
    return b, preview


# ============================================================
# 发送：复用 raw_printer（winspool RAW）
# ============================================================
def send(
    builder: EscpBuilder,
    printer_name: str,
    copies: int = 1,
    dry_run: bool = False,
    preview: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """发送制表符表格到打印机。完全复用 raw_printer.send_script。

    返回结构与 raw_printer.send_script 一致（ok/dryRun/copies/bytes/steps/hexHead/preview）。
    preview 由调用方传入（build_doc 已算好），避免重复渲染。
    """
    script = builder.to_script()
    result = raw_printer.send_script(script, printer_name, copies=copies, dry_run=dry_run)
    if preview is not None:
        result["preview"] = preview
    return result


if __name__ == "__main__":
    # 自检：dryRun 全流程
    entry = {
        "entryNo": "RK260706001",
        "farmerName": "张三",
        "grainNameSnap": "小麦(一等)",
        "wareareaNameSnap": "1号仓",
        "grossWeight": 1510.5, "tareWeight": 9.5, "deductWeight": 0.5, "netWeight": 1500.5,
        "moisture": 13.2, "impurity": 1.0, "unitPrice": 2.80, "adjustedAmount": 4201.40,
        "createBy": "库管员A", "factoryName": "某某粮油烘干厂",
    }
    builder, preview = build_doc("grain_in", entry)
    res = send(builder, printer_name="", copies=1, dry_run=True, preview=preview)
    print("dryRun: ok=%s bytes=%s" % (res["ok"], res["bytes"]))
    print("steps:", res["steps"])
    print("hexHead 前 40:", (res.get("hexHead") or "")[:40])
