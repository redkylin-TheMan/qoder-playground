"""gdi_kernel.py — Windows GDI 图形打印底层封装（纯 ctypes，零依赖）

与 raw_printer.py 的关系：
  - raw_printer.py 走 winspool 的 RAW 字节通道（OpenPrinter/WritePrinter），
    绕过 Windows GDI 渲染，直接下发 ESC/P 指令 —— 字符打印用。
  - gdi_kernel.py   走 GDI 渲染通道（CreateDCW/StartDoc/StartPage/绘图），
    由 Windows 驱动光栅化 —— 图形表格打印用，效果等同 Excel/Word。
  两者完全独立，互不影响。

⚠️ 关键 API 归属（极易踩坑）：
  - StartDoc / StartPage / EndPage / EndDoc 在 gdi32（不是 winspool！）
  - 名字带 ...Printer 的那一组（StartDocPrinter 等）才在 winspool.drv
  - DrawTextW 在 user32；TextOutW 在 gdi32
  - CreateDCW 第一参驱动名固定 "WINSPOOL"（大写常量，不是 DLL 名）

兼容 32 位 Python：gdi32/user32/winspool.drv 在 32/64 位系统均有，
调用约定均为 stdcall（WinDLL 正确）。
"""

from __future__ import annotations

import ctypes
import ctypes.wintypes as wintypes
from ctypes import byref, c_int, c_void_p
from typing import Any, Dict, List, Optional, Tuple

# 复用 raw_printer 的列打印机能力（PowerShell 调用，GDI 通道通用）
from raw_printer import list_printers


# ============================================================
# Win32 DLL 绑定
# ============================================================
_GDI32 = ctypes.WinDLL("gdi32", use_last_error=True)
_USER32 = ctypes.WinDLL("user32", use_last_error=True)
_WINSPOOL = ctypes.WinDLL("winspool.drv", use_last_error=True)

HDC = wintypes.HDC
HGDIOBJ = wintypes.HANDLE
COLORREF = wintypes.DWORD


# ============================================================
# 结构体
# ============================================================
class DOCINFOW(ctypes.Structure):
    _fields_ = [
        ("cbSize", c_int),
        ("lpszDocName", wintypes.LPCWSTR),
        ("lpszOutput", wintypes.LPCWSTR),
        ("lpszDatatype", wintypes.LPCWSTR),
        ("fwType", wintypes.DWORD),
    ]


class LOGFONTW(ctypes.Structure):
    _fields_ = [
        ("lfHeight", c_int),
        ("lfWidth", c_int),
        ("lfEscapement", c_int),
        ("lfOrientation", c_int),
        ("lfWeight", c_int),
        ("lfItalic", wintypes.BYTE),
        ("lfUnderline", wintypes.BYTE),
        ("lfStrikeOut", wintypes.BYTE),
        ("lfCharSet", wintypes.BYTE),
        ("lfOutPrecision", wintypes.BYTE),
        ("lfClipPrecision", wintypes.BYTE),
        ("lfQuality", wintypes.BYTE),
        ("lfPitchAndFamily", wintypes.BYTE),
        ("lfFaceName", wintypes.WCHAR * 32),  # LF_FACESIZE = 32
    ]


class RECT(ctypes.Structure):
    _fields_ = [("left", c_int), ("top", c_int), ("right", c_int), ("bottom", c_int)]


class POINT(ctypes.Structure):
    _fields_ = [("x", c_int), ("y", c_int)]


# DEVMODE 公共部分前 220 字节左右（变长结构，只能 cast 前部，见 open_printer_dc）
# 这里只为访问 dmFields/dmPaperSize/dmPaperWidth/dmPaperLength/dmDriverExtra
class DEVMODE_HEAD(ctypes.Structure):
    _fields_ = [
        ("dmDeviceName", wintypes.WCHAR * 32),
        ("dmSpecVersion", wintypes.WORD),
        ("dmDriverVersion", wintypes.WORD),
        ("dmSize", wintypes.WORD),
        ("dmDriverExtra", wintypes.WORD),
        ("dmFields", wintypes.DWORD),
        ("dmOrientation", ctypes.c_short),
        ("dmPaperSize", ctypes.c_short),
        ("dmPaperLength", ctypes.c_short),
        ("dmPaperWidth", ctypes.c_short),
        ("dmScale", ctypes.c_short),
        ("dmCopies", ctypes.c_short),
        ("dmDefaultSource", ctypes.c_short),
        ("dmPrintQuality", ctypes.c_short),
        ("dmColor", ctypes.c_short),
        ("dmDuplex", ctypes.c_short),
        ("dmYResolution", ctypes.c_short),
        ("dmTTOption", ctypes.c_short),
        ("dmCollate", ctypes.c_short),
        ("dmFormName", wintypes.WCHAR * 32),
        ("dmLogPixels", wintypes.WORD),
        ("dmBitsPerPel", wintypes.DWORD),
        ("dmPelsWidth", wintypes.DWORD),
        ("dmPelsHeight", wintypes.DWORD),
        ("dmDisplayFlags", wintypes.DWORD),
        ("dmDisplayFrequency", wintypes.DWORD),
        ("dmICMMethod", wintypes.DWORD),
        ("dmICMIntent", wintypes.DWORD),
        ("dmMediaType", wintypes.DWORD),
        ("dmDitherType", wintypes.DWORD),
        ("dmReserved1", wintypes.DWORD),
        ("dmReserved2", wintypes.DWORD),
        ("dmPanningWidth", wintypes.DWORD),
        ("dmPanningHeight", wintypes.DWORD),
    ]


# ============================================================
# gdi32 API 绑定
# ============================================================
_GDI32.CreateDCW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.LPCWSTR, c_void_p]
_GDI32.CreateDCW.restype = HDC

_GDI32.DeleteDC.argtypes = [HDC]
_GDI32.DeleteDC.restype = wintypes.BOOL

_GDI32.ResetDCW.argtypes = [HDC, c_void_p]
_GDI32.ResetDCW.restype = HDC

_GDI32.StartDocW.argtypes = [HDC, ctypes.POINTER(DOCINFOW)]
_GDI32.StartDocW.restype = c_int
_GDI32.EndDoc.argtypes = [HDC]
_GDI32.EndDoc.restype = c_int
_GDI32.StartPage.argtypes = [HDC]
_GDI32.StartPage.restype = c_int
_GDI32.EndPage.argtypes = [HDC]
_GDI32.EndPage.restype = c_int

_GDI32.GetDeviceCaps.argtypes = [HDC, c_int]
_GDI32.GetDeviceCaps.restype = c_int

_GDI32.Rectangle.argtypes = [HDC, c_int, c_int, c_int, c_int]
_GDI32.Rectangle.restype = wintypes.BOOL
_GDI32.MoveToEx.argtypes = [HDC, c_int, c_int, ctypes.POINTER(POINT)]
_GDI32.MoveToEx.restype = wintypes.BOOL
_GDI32.LineTo.argtypes = [HDC, c_int, c_int]
_GDI32.LineTo.restype = wintypes.BOOL

_GDI32.CreatePen.argtypes = [c_int, c_int, COLORREF]
_GDI32.CreatePen.restype = HGDIOBJ
_GDI32.SelectObject.argtypes = [HDC, HGDIOBJ]
_GDI32.SelectObject.restype = HGDIOBJ
_GDI32.DeleteObject.argtypes = [HGDIOBJ]
_GDI32.DeleteObject.restype = wintypes.BOOL
_GDI32.GetStockObject.argtypes = [c_int]
_GDI32.GetStockObject.restype = HGDIOBJ

_GDI32.CreateFontW.argtypes = [
    c_int, c_int, c_int, c_int, c_int,  # h,w,escapement,orientation,weight
    wintypes.BYTE, wintypes.BYTE, wintypes.BYTE,  # italic,underline,strikeout
    wintypes.BYTE, wintypes.BYTE, wintypes.BYTE,  # charset,outprec,clipprec
    wintypes.BYTE, wintypes.BYTE,  # quality,pitchAndFamily
    wintypes.LPCWSTR,  # faceName
]
_GDI32.CreateFontW.restype = HGDIOBJ

_GDI32.TextOutW.argtypes = [HDC, c_int, c_int, wintypes.LPCWSTR, c_int]
_GDI32.TextOutW.restype = wintypes.BOOL
_GDI32.SetBkMode.argtypes = [HDC, c_int]
_GDI32.SetBkMode.restype = c_int
_GDI32.SetTextColor.argtypes = [HDC, COLORREF]
_GDI32.SetTextColor.restype = COLORREF
_GDI32.SetTextAlign.argtypes = [HDC, wintypes.UINT]
_GDI32.SetTextAlign.restype = wintypes.UINT

# ============================================================
# user32 API 绑定
# ============================================================
_USER32.DrawTextW.argtypes = [HDC, wintypes.LPCWSTR, c_int, ctypes.POINTER(RECT), wintypes.UINT]
_USER32.DrawTextW.restype = c_int

# ============================================================
# winspool.drv API 绑定（仅用于改纸张时取/设 DEVMODE）
# ============================================================
_WINSPOOL.OpenPrinterW.argtypes = [wintypes.LPCWSTR, ctypes.POINTER(c_void_p), c_void_p]
_WINSPOOL.OpenPrinterW.restype = wintypes.BOOL
_WINSPOOL.ClosePrinter.argtypes = [c_void_p]
_WINSPOOL.ClosePrinter.restype = wintypes.BOOL
_WINSPOOL.DocumentPropertiesW.argtypes = [
    wintypes.HWND, c_void_p, wintypes.LPCWSTR, c_void_p, c_void_p, wintypes.DWORD
]
_WINSPOOL.DocumentPropertiesW.restype = c_int


# ============================================================
# 常量
# ============================================================
# GetDeviceCaps 索引
LOGPIXELSX = 88
LOGPIXELSY = 90
HORZRES = 8
VERTRES = 10
PHYSICALWIDTH = 110
PHYSICALHEIGHT = 111
PHYSICALOFFSETX = 112
PHYSICALOFFSETY = 113

# DEVMODE dmFields 位
DM_PAPERSIZE = 0x2
DM_PAPERLENGTH = 0x4
DM_PAPERWIDTH = 0x8
DM_FORMNAME = 0x10000
DMPAPER_USER = 256

# DocumentProperties fMode
DM_OUT_BUFFER = 2
DM_IN_BUFFER = 1

# 画笔
PS_SOLID = 0
PS_NULL = 5

# Stock 对象
NULL_BRUSH = 5  # 空心刷（画表格框线防填白）
BLACK_PEN = 7  # 系统默认黑笔

# 字体 charset
GB2312_CHARSET = 134
DEFAULT_CHARSET = 1

# 字体 weight
FW_NORMAL = 400
FW_BOLD = 700

# SetBkMode
TRANSPARENT = 1
OPAQUE = 2

# DrawText 格式位
DT_LEFT = 0x0
DT_CENTER = 0x1
DT_RIGHT = 0x2
DT_VCENTER = 0x4
DT_SINGLELINE = 0x20
DT_WORDBREAK = 0x10
DT_NOCLIP = 0x100

# SetTextAlign
TA_LEFT = 0x0
TA_CENTER = 0x6
TA_RIGHT = 0x2
TA_TOP = 0x0
TA_BASELINE = 0x18


# ============================================================
# 错误类
# ============================================================
class GdiError(Exception):
    """GDI 打印失败（含 Win32 错误码）。"""

    def __init__(self, message: str, win32_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.win32_code = win32_code


def _last_error() -> int:
    return ctypes.get_last_error()


# ============================================================
# 自定义纸张：构造 DEVMODE（变长处理）
# ============================================================
def build_devmode_with_paper(
    printer_name: str,
    paper_mm: Optional[Tuple[float, float]] = None,
) -> Optional[Any]:
    """取打印机默认 DEVMODE，按纸张尺寸（毫米）改写后返回。

    paper_mm = (width_mm, length_mm)，连续针打纸用 (75, 100) 表示 7.5cm 宽、10cm 页长。
    返回一个变长 buffer（含驱动私有数据），可直接传给 CreateDCW 第 4 参。
    打印机不存在或取 DEVMODE 失败时返回 None（让 CreateDC 用默认纸张）。
    """
    if paper_mm is None:
        return None

    hp = c_void_p()
    if not _WINSPOOL.OpenPrinterW(printer_name, byref(hp), None):
        return None
    try:
        # 1. 问 DEVMODE 缓冲区多大（含 dmDriverExtra 私有数据）
        size = _WINSPOOL.DocumentPropertiesW(None, hp, printer_name, None, None, 0)
        if size <= 0:
            return None
        buf = ctypes.create_string_buffer(size)
        # 2. 取默认 DEVMODE
        if _WINSPOOL.DocumentPropertiesW(None, hp, printer_name, buf, None, DM_OUT_BUFFER) != 1:
            return None
        # 3. cast 前部访问公共字段
        dm = ctypes.cast(buf, ctypes.POINTER(DEVMODE_HEAD)).contents
        dm.dmFields |= DM_PAPERSIZE | DM_PAPERLENGTH | DM_PAPERWIDTH
        dm.dmPaperSize = DMPAPER_USER
        # dmPaperWidth/Length 单位 0.1mm（width=短边，length=长边）
        dm.dmPaperWidth = int(paper_mm[0] * 10)
        dm.dmPaperLength = int(paper_mm[1] * 10)
        # 4. 让驱动验证（可能改写不支持的值；失败也不致命，CreateDC 会兜底）
        _WINSPOOL.DocumentPropertiesW(None, hp, printer_name, buf, buf, DM_IN_BUFFER | DM_OUT_BUFFER)
        return buf
    finally:
        _WINSPOOL.ClosePrinter(hp)


# ============================================================
# 打印机 DC
# ============================================================
def open_printer_dc(
    printer_name: str,
    paper_mm: Optional[Tuple[float, float]] = None,
) -> int:
    """打开打印机 DC。返回 hdc（整数句柄）。

    paper_mm 指定时走自定义纸张（DEVMODE），否则用驱动默认纸张。
    失败抛 GdiError。
    """
    devmode = build_devmode_with_paper(printer_name, paper_mm)
    hdc = _GDI32.CreateDCW("WINSPOOL", printer_name, None, devmode)
    if not hdc:
        code = _last_error()
        raise GdiError(
            "CreateDCW 打开打印机 DC 失败：「%s」（Win32 %d）" % (printer_name, code), code
        )
    return hdc


def close_printer_dc(hdc: int) -> None:
    """释放打印机 DC（DeleteDC，不是 ReleaseDC）。"""
    if hdc:
        _GDI32.DeleteDC(hdc)


def get_caps(hdc: int) -> Dict[str, int]:
    """取打印机能力：DPI、物理整页、不可打边距。"""
    return {
        "dpi_x": _GDI32.GetDeviceCaps(hdc, LOGPIXELSX),
        "dpi_y": _GDI32.GetDeviceCaps(hdc, LOGPIXELSY),
        "phys_w": _GDI32.GetDeviceCaps(hdc, PHYSICALWIDTH),
        "phys_h": _GDI32.GetDeviceCaps(hdc, PHYSICALHEIGHT),
        "offset_x": _GDI32.GetDeviceCaps(hdc, PHYSICALOFFSETX),
        "offset_y": _GDI32.GetDeviceCaps(hdc, PHYSICALOFFSETY),
        "printable_w": _GDI32.GetDeviceCaps(hdc, HORZRES),
        "printable_h": _GDI32.GetDeviceCaps(hdc, VERTRES),
    }


# ============================================================
# 字体 / 画笔
# ============================================================
def create_font(
    face_name: str = "宋体",
    size_pt: float = 10.0,
    bold: bool = False,
    dpi_y: int = 180,
) -> int:
    """创建中文字体。返回 HFONT。

    face_name: "宋体"/"黑体"。size_pt: 磅值。dpi_y: 打印机纵向 DPI（按它换算像素高度）。
    用负 lfHeight（按字符净高选字，最稳）。
    """
    height = -int(round(size_pt * dpi_y / 72.0))
    weight = FW_BOLD if bold else FW_NORMAL
    hfont = _GDI32.CreateFontW(
        height, 0, 0, 0, weight,
        0, 0, 0,  # italic/underline/strikeout
        GB2312_CHARSET, 0, 0, 0, 0,
        face_name,
    )
    if not hfont:
        raise GdiError("CreateFontW 失败：「%s」" % face_name)
    return hfont


def create_pen(width_px: int = 1, color: int = 0x000000) -> int:
    """创建实线笔。返回 HPEN。"""
    hpen = _GDI32.CreatePen(PS_SOLID, width_px, color)
    if not hpen:
        raise GdiError("CreatePen 失败")
    return hpen


def delete_obj(hobj: int) -> None:
    """删除 GDI 对象（字体/笔）。"""
    if hobj:
        _GDI32.DeleteObject(hobj)


# ============================================================
# 绘图原语（操作一个已打开的 hdc）
# ============================================================
def select_object(hdc: int, hobj: int) -> int:
    """选入 GDI 对象，返回旧对象句柄（需保留并最终选回）。"""
    return _GDI32.SelectObject(hdc, hobj) or 0


def select_null_brush(hdc: int) -> int:
    """选入空心刷（画表格框线防填白），返回旧刷。"""
    return select_object(hdc, _GDI32.GetStockObject(NULL_BRUSH))


def select_black_pen(hdc: int, hpen: int) -> int:
    """选入自定义笔，返回旧笔。"""
    return select_object(hdc, hpen)


def set_text_transparent(hdc: int) -> None:
    """文字背景透明（否则中文字带白底盖表格线）。"""
    _GDI32.SetBkMode(hdc, TRANSPARENT)


def draw_text_center(hdc: int, text: str, rect: Tuple[int, int, int, int],
                     hfont: int, bold: bool = False) -> None:
    """在矩形内居中写文字（水平+垂直居中）。每次都重选字体+透明背景。

    rect = (left, top, right, bottom) 像素坐标。
    """
    old_font = select_object(hdc, hfont)
    set_text_transparent(hdc)
    _GDI32.SetTextColor(hdc, 0x000000)  # 黑
    r = RECT(rect[0], rect[1], rect[2], rect[3])
    _USER32.DrawTextW(hdc, text, -1, byref(r), DT_CENTER | DT_VCENTER | DT_SINGLELINE | DT_NOCLIP)
    if old_font:
        select_object(hdc, old_font)


def draw_text_left(hdc: int, text: str, rect: Tuple[int, int, int, int],
                   hfont: int) -> None:
    """在矩形内左对齐写文字（垂直居中）。"""
    old_font = select_object(hdc, hfont)
    set_text_transparent(hdc)
    _GDI32.SetTextColor(hdc, 0x000000)
    r = RECT(rect[0], rect[1], rect[2], rect[3])
    _USER32.DrawTextW(hdc, text, -1, byref(r), DT_LEFT | DT_VCENTER | DT_SINGLELINE | DT_NOCLIP)
    if old_font:
        select_object(hdc, old_font)


def draw_rect(hdc: int, rect: Tuple[int, int, int, int]) -> None:
    """画矩形边框（当前笔的线条 + 当前刷填充；调用方需先选空心刷）。"""
    _GDI32.Rectangle(hdc, rect[0], rect[1], rect[2], rect[3])


def draw_line(hdc: int, x1: int, y1: int, x2: int, y2: int) -> None:
    """画线段（当前笔）。"""
    _GDI32.MoveToEx(hdc, x1, y1, None)
    _GDI32.LineTo(hdc, x2, y2)


# ============================================================
# 文档 / 页 控制
# ============================================================
def start_doc(hdc: int, doc_name: str = "GDI 表格") -> int:
    """开始打印文档。返回值 >0 成功，<=0 失败。"""
    di = DOCINFOW()
    di.cbSize = ctypes.sizeof(DOCINFOW)
    di.lpszDocName = doc_name
    di.lpszOutput = None
    di.lpszDatatype = None
    di.fwType = 0
    ret = _GDI32.StartDocW(hdc, byref(di))
    if ret <= 0:
        code = _last_error()
        raise GdiError("StartDocW 失败（Win32 %d）" % code, code)
    return ret


def end_doc(hdc: int) -> None:
    _GDI32.EndDoc(hdc)


def start_page(hdc: int) -> None:
    """开始一页。⚠️ EndPage 会重置 DC，页内需重新选对象。"""
    if _GDI32.StartPage(hdc) <= 0:
        code = _last_error()
        raise GdiError("StartPage 失败（Win32 %d）" % code, code)


def end_page(hdc: int) -> None:
    if _GDI32.EndPage(hdc) <= 0:
        code = _last_error()
        raise GdiError("EndPage 失败（Win32 %d）" % code, code)


if __name__ == "__main__":
    # 自检：列打印机（验证 import 链路 + winspool 可用）
    info = list_printers()
    print("默认打印机:", info.get("defaultPrinter"))
    print("打印机数量:", len(info.get("printers") or []))
    if info.get("defaultPrinter"):
        print("→ 有默认打印机，可尝试 GDI 打印（需现场硬件）")
    else:
        print("→ 无默认打印机（开发机正常，现场部署会有）")
