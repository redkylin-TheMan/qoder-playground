"""gdi_docs.py — GDI 单据构建 + 发送（对应 print_docs.py 的角色）

与 print_docs.py 的关系：
  - print_docs.py 产出 EscpBuilder（ESC/P 指令），走 raw_printer winspool RAW 通道
  - gdi_docs.py   产出 LaidTable（像素坐标），走 gdi_kernel GDI 渲染通道
  两者完全独立，互不影响。

接口：
  build_doc(doc_type, entry, font, model) -> (table, preview)
  send(table, printer_name, copies, dry_run, paper_mm, model) -> dict

send 返回结构与 raw_printer.send_script 对齐：
  {ok, dryRun, copies, bytes(=格子数), steps:[...], preview, error?, win32Code?}
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

import gdi_kernel as gk
import gdi_tables as gt
from gdi_tables import Table, build_table, to_preview, layout, resolve_paper


# ============================================================
# 字体预设（与 ESC/P 侧的 font 预设概念对齐，但映射到 GDI 参数）
# ============================================================
DEFAULT_FONT = {"bold": True, "font": "hei", "size": 9.0}


def _resolve_font(font: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """合并字体预设。font 字段：font('song'|'hei')/bold/size。"""
    out = dict(DEFAULT_FONT)
    if font:
        for k, v in font.items():
            if v is not None:
                out[k] = v
    return out


def _font_face(font_cfg: Dict[str, Any]) -> str:
    return "黑体" if font_cfg.get("font") == "hei" else "宋体"


# ============================================================
# 构建（layout）
# ============================================================
def build_doc(
    doc_type: str,
    entry: Dict[str, Any],
    font: Optional[Dict[str, Any]] = None,
    model: Optional[Any] = None,
) -> Tuple[Table, List[Dict[str, Any]]]:
    """构建 Table 模型 + 预览。不碰打印机，dryRun 也用这个。

    与 print_docs.build_doc 同名同语义，但产出 Table 而非 EscpBuilder。
    entry 缺 printDate 时补今天。
    """
    if not entry.get("printDate"):
        entry = dict(entry)
        entry["printDate"] = time.strftime("%Y-%m-%d")
    table = build_table(doc_type, entry)
    preview = to_preview(table)
    return table, preview


# ============================================================
# 渲染（把 LaidTable 翻译成 GDI 绘图调用）
# ============================================================
def render_page(
    hdc: int,
    laid: gt.LaidTable,
    font_cfg: Dict[str, Any],
    dpi_y: int,
) -> int:
    """在已 StartPage 的 DC 上画一页。返回画的格子数。

    ⚠️ EndPage 会重置 DC，所以本函数内重新选 pen/brush/font。
    """
    face = _font_face(font_cfg)
    size_default = float(font_cfg.get("size", 9.0))
    size_title = size_default + 4.0
    bold_default = bool(font_cfg.get("bold", True))

    # 创建对象（每页新建，EndPage 后统一删除）
    hpen = gk.create_pen(width_px=1, color=0x000000)
    hfont_body = gk.create_font(face_name=face, size_pt=size_default, bold=bold_default, dpi_y=dpi_y)
    hfont_body_bold = gk.create_font(face_name=face, size_pt=size_default, bold=True, dpi_y=dpi_y)
    hfont_title = gk.create_font(face_name=face, size_pt=size_title, bold=True, dpi_y=dpi_y)

    count = 0
    try:
        # 选空心刷（防 Rectangle 填白）+ 黑笔
        old_brush = gk.select_null_brush(hdc)
        old_pen = gk.select_black_pen(hdc, hpen)

        # ---- 画所有格子框线 ----
        for rect in laid.rects:
            gk.draw_rect(hdc, rect)
            count += 1

        # ---- 标题文字 ----
        for lc in laid.title_cells:
            if not lc.text:
                continue
            hfont = hfont_title if lc.bold else hfont_body
            gk.draw_text_center(hdc, lc.text, lc.rect, hfont)

        # ---- meta 文字（k 粗左对齐，v 普通左对齐）----
        for lc in laid.meta_cells:
            if not lc.text:
                continue
            hfont = hfont_body_bold if lc.bold else hfont_body
            gk.draw_text_left(hdc, lc.text, lc.rect, hfont)

        # ---- 数据网格文字 ----
        for row_cells in laid.grid_cells:
            for lc in row_cells:
                if not lc.text:
                    continue
                hfont = hfont_body_bold if lc.bold else hfont_body
                if lc.align == "center":
                    gk.draw_text_center(hdc, lc.text, lc.rect, hfont)
                else:
                    gk.draw_text_left(hdc, lc.text, lc.rect, hfont)

        # ---- footer 文字 ----
        for row_cells in laid.footer_cells:
            for lc in row_cells:
                if not lc.text:
                    continue
                hfont = hfont_body_bold if lc.bold else hfont_body
                gk.draw_text_left(hdc, lc.text, lc.rect, hfont)

        # 选回旧对象（便于 EndPage 后清理）
        if old_pen:
            gk.select_object(hdc, old_pen)
        if old_brush:
            gk.select_object(hdc, old_brush)
    finally:
        gk.delete_obj(hpen)
        gk.delete_obj(hfont_body)
        gk.delete_obj(hfont_body_bold)
        gk.delete_obj(hfont_title)
    return count


# ============================================================
# 发送（dryRun 或真打）
# ============================================================
def send(
    table: Table,
    printer_name: str,
    copies: int = 1,
    dry_run: bool = False,
    paper_mm: Optional[Tuple[float, float]] = None,
    model: Optional[Any] = None,
    font: Optional[Dict[str, Any]] = None,
    preview: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """发送 GDI 表格到打印机。

    dry_run=True：只算布局，返回格子数和预览，不碰打印机。
    dry_run=False：打开打印机 DC，StartDoc → 每份一页 StartPage/绘图/EndPage → EndDoc。
    返回 {ok, dryRun, copies, bytes(=格子数), steps, preview, error?, win32Code?}
    """
    copies = max(1, int(copies))
    steps: List[str] = []
    font_cfg = _resolve_font(font)

    # 预览先算好（dryRun 和真打都返回）
    if preview is None:
        preview = to_preview(table)

    if dry_run:
        # dryRun：用假 DPI 算布局，统计格子数
        laid = layout(table, dpi=180,
                      page_w_mm=paper_mm[0] if paper_mm else 75.0,
                      font_default=float(font_cfg.get("size", 9.0)))
        steps.append("dryRun: 布局 %dx%d px, %d 个格子" % (laid.width, laid.height, len(laid.rects)))
        steps.append("dryRun: 未发送")
        return {
            "ok": True, "dryRun": True, "copies": copies,
            "bytes": len(laid.rects), "steps": steps, "preview": preview,
        }

    # 真打：必须有打印机名
    if not printer_name:
        info = gk.list_printers()
        default = info.get("defaultPrinter") or ""
        if not default:
            return {
                "ok": False, "dryRun": False, "copies": copies, "bytes": 0,
                "steps": steps, "preview": preview,
                "error": "未指定打印机名，且系统无默认打印机",
            }
        printer_name = default
        steps.append("使用系统默认打印机: %s" % printer_name)

    page_w_mm = paper_mm[0] if paper_mm else 75.0
    hdc = None
    total_cells = 0
    try:
        hdc = gk.open_printer_dc(printer_name, paper_mm=paper_mm)
        caps = gk.get_caps(hdc)
        dpi_y = caps["dpi_y"] or 180
        dpi_x = caps["dpi_x"] or 180
        steps.append("DC 已打开: %dx%d DPI, 物理页 %dx%d px" % (dpi_x, dpi_y, caps["phys_w"], caps["phys_h"]))

        # 用实际 DPI 布局
        laid = layout(table, dpi=dpi_x, page_w_mm=page_w_mm,
                      font_default=float(font_cfg.get("size", 9.0)))
        total_cells = len(laid.rects)

        gk.start_doc(hdc, doc_name="GDI 表格 - %s" % (table.title or "结算单"))
        try:
            for i in range(copies):
                gk.start_page(hdc)
                n = render_page(hdc, laid, font_cfg, dpi_y)
                gk.end_page(hdc)
                steps.append("[copy %d] 绘制 %d 个格子" % (i + 1, n))
        finally:
            gk.end_doc(hdc)
        steps.append("完成: 共 %d 份" % copies)
    except gk.GdiError as exc:
        steps.append("FAIL: %s" % exc)
        return {
            "ok": False, "dryRun": False, "copies": copies, "bytes": total_cells,
            "steps": steps, "preview": preview,
            "error": str(exc), "win32Code": exc.win32_code,
        }
    except Exception as exc:
        steps.append("EXCEPTION: %s" % exc)
        return {
            "ok": False, "dryRun": False, "copies": copies, "bytes": total_cells,
            "steps": steps, "preview": preview,
            "error": "GDI 渲染异常：%s" % exc,
        }
    finally:
        if hdc:
            gk.close_printer_dc(hdc)

    return {
        "ok": True, "dryRun": False, "copies": copies, "bytes": total_cells,
        "steps": steps, "preview": preview,
    }


if __name__ == "__main__":
    # 自检：dryRun 全流程（不碰打印机）
    entry = {
        "entryNo": "RK260706001",
        "farmerName": "张三",
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
    }
    table, preview = build_doc("grain_in", entry)
    res = send(table, printer_name="", copies=1, dry_run=True, paper_mm=(75.0, 100.0))
    print("dryRun 结果:", "ok=%s bytes=%s" % (res["ok"], res["bytes"]))
    for s in res["steps"]:
        print("  ", s)
