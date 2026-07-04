"""raw_printer.py — 通过 winspool 发送 RAW 字节流到针式打印机（移植自 raw-print.ps1）

工作流：
  1) 接收 escp.EscpBuilder.to_script() 产出的脚本行列表（List[str]）
  2) 按规则组装字节流：
       - '@@RAW@@' 开头的行：其后字符按 latin1 取字节（控制码原样发送）
       - 其余行：UTF-8 文本 → GB18030 编码 → 行末补 LF
  3) 用 ctypes 调 winspool.drv 的 OpenPrinterA/StartDocPrinterA/WritePrinter 发送
     pDataType="RAW"，绕过 Windows GDI 渲染，保证 ESC/P 复写指令不被改写

零原生依赖：只用 ctypes + subprocess（列打印机时调 PowerShell）。
兼容 32 位 Python（winspool.drv 在 32/64 位系统均有）。
"""

from __future__ import annotations

import ctypes
import ctypes.wintypes as wintypes
import subprocess
import sys
from ctypes import byref, c_char_p, c_int, c_void_p, sizeof
from typing import Any, Dict, List, Optional, Tuple

# ============== winspool.drv P/Invoke ==============
# 注意：DLL 名必须是小写 "winspool.drv"（参考 dprinter-web README，改回 winspool.Dll 会报 HRESULT 0x8007007E）
# use_last_error=True 让 ctypes.get_last_error() 能取到 GetLastError 的值（需配合 argtypes）
_WINSPOOL = ctypes.WinDLL("winspool.drv", use_last_error=True)

# BOOL OpenPrinterA(LPSTR szPrinter, LPHANDLE hPrinter, LPPRINTER_DEFAULTSA pd)
_WINSPOOL.OpenPrinterA.argtypes = [c_char_p, ctypes.POINTER(c_void_p), c_void_p]
_WINSPOOL.OpenPrinterA.restype = wintypes.BOOL

# BOOL ClosePrinter(HANDLE hPrinter)
_WINSPOOL.ClosePrinter.argtypes = [c_void_p]
_WINSPOOL.ClosePrinter.restype = wintypes.BOOL

# BOOL StartDocPrinterA(HANDLE hPrinter, int level, LPDOCINFOA di)
# DOCINFOA { pDocName, pOutputFile, pDataType } 三个 LPSTR
class DOCINFOA(ctypes.Structure):
    _fields_ = [
        ("pDocName", c_char_p),
        ("pOutputFile", c_char_p),
        ("pDataType", c_char_p),
    ]

_WINSPOOL.StartDocPrinterA.argtypes = [c_void_p, c_int, ctypes.POINTER(DOCINFOA)]
_WINSPOOL.StartDocPrinterA.restype = wintypes.BOOL

# BOOL EndDocPrinter(HANDLE hPrinter)
_WINSPOOL.EndDocPrinter.argtypes = [c_void_p]
_WINSPOOL.EndDocPrinter.restype = wintypes.BOOL

# BOOL StartPagePrinter(HANDLE hPrinter)
_WINSPOOL.StartPagePrinter.argtypes = [c_void_p]
_WINSPOOL.StartPagePrinter.restype = wintypes.BOOL

# BOOL EndPagePrinter(HANDLE hPrinter)
_WINSPOOL.EndPagePrinter.argtypes = [c_void_p]
_WINSPOOL.EndPagePrinter.restype = wintypes.BOOL

# BOOL WritePrinter(HANDLE hPrinter, LPVOID pBytes, DWORD dwCount, LPDWORD dwWritten)
_WINSPOOL.WritePrinter.argtypes = [c_void_p, c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
_WINSPOOL.WritePrinter.restype = wintypes.BOOL


class PrinterError(Exception):
    """打印机发送失败（含 Win32 错误码）。"""

    def __init__(self, message: str, win32_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.win32_code = win32_code

    def to_dict(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"code": "PRINTER_ERROR", "message": str(self)}
        if self.win32_code is not None:
            payload["win32Code"] = self.win32_code
        return payload


def _last_error() -> int:
    return ctypes.get_last_error() if hasattr(ctypes, "get_last_error") else ctypes.windll.kernel32.GetLastError()


def send_bytes_to_printer(printer_name: str, data: bytes) -> None:
    """把原始字节流以 RAW 方式发给指定打印机队列。失败抛 PrinterError。"""
    # 打印机名编码为 ANSI（OpenPrinterA）；若名字含非 ANSI 字符理论上应走 OpenPrinterW，
    # 但得力打印机队列名基本都是 ASCII，这里用 ANSI 足够，且与原 ps1 行为一致。
    name_bytes = printer_name.encode("mbcs", errors="replace") if hasattr(str, "encode") else printer_name.encode("ascii", errors="replace")

    hPrinter = c_void_p()
    if not _WINSPOOL.OpenPrinterA(name_bytes, byref(hPrinter), None):
        code = _last_error()
        raise PrinterError('OpenPrinter 失败：打印机名「%s」未找到或队列不可用（Win32 %d）' % (printer_name, code), code)
    try:
        di = DOCINFOA()
        di.pDocName = b"ESC-P Document"
        di.pOutputFile = None
        di.pDataType = b"RAW"
        if not _WINSPOOL.StartDocPrinterA(hPrinter, 1, byref(di)):
            code = _last_error()
            raise PrinterError("StartDocPrinter 失败（Win32 %d）" % code, code)
        try:
            if not _WINSPOOL.StartPagePrinter(hPrinter):
                code = _last_error()
                raise PrinterError("StartPagePrinter 失败（Win32 %d）" % code, code)
            try:
                buf = ctypes.create_string_buffer(data, len(data))
                written = wintypes.DWORD(0)
                if not _WINSPOOL.WritePrinter(hPrinter, buf, len(data), byref(written)):
                    code = _last_error()
                    raise PrinterError("WritePrinter 失败（Win32 %d）" % code, code)
            finally:
                _WINSPOOL.EndPagePrinter(hPrinter)
        finally:
            _WINSPOOL.EndDocPrinter(hPrinter)
    finally:
        _WINSPOOL.ClosePrinter(hPrinter)


# ============== 脚本 → 字节流 ==============
def build_bytes(script_lines: List[str]) -> bytes:
    """把 escp.EscpBuilder.to_script() 的脚本行列表组装成待发送字节流。

    与 raw-print.ps1 的 Build-Bytes 逻辑完全一致：
      - '@@RAW@@' 行：其后字符按 latin1 解码为字节（控制码原样）
      - 文本行：UTF-8 字符串 → GB18030 编码，行末补 LF
    """
    chunks: List[bytes] = []
    for line in script_lines:
        if line.startswith("@@RAW@@"):
            # 控制码：latin1 字节原样
            chunks.append(line[7:].encode("latin1", errors="replace"))
        else:
            # 文本：GB18030 编码 + LF 走纸
            chunks.append(line.encode("gb18030", errors="replace") + b"\n")
    return b"".join(chunks)


# ============== 发送入口 ==============
def send_script(
    script_lines: List[str],
    printer_name: str,
    copies: int = 1,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """发送 ESC/P 脚本到打印机。

    返回 {ok, dryRun, copies, bytes, steps, hexHead, error?}
    dry_run=True 时只组装字节流并返回 hex 摘要，不真打。
    """
    copies = max(1, int(copies))
    steps: List[str] = []

    try:
        data = build_bytes(script_lines)
    except Exception as exc:
        return {"ok": False, "dryRun": dry_run, "copies": copies, "bytes": 0, "steps": steps,
                "error": "组装字节流失败：%s" % exc}

    steps.append("built %d bytes" % len(data))
    hex_head = " ".join("%02X" % c for c in data[:64])

    if dry_run:
        steps.append("dryRun: 未发送")
        return {"ok": True, "dryRun": True, "copies": copies, "bytes": len(data),
                "steps": steps, "hexHead": hex_head}

    if not printer_name:
        return {"ok": False, "dryRun": False, "copies": copies, "bytes": len(data), "steps": steps,
                "hexHead": hex_head, "error": "未指定打印机名且非 dryRun 模式"}

    # 多份：循环 copies 次发送（物理复写由纸张层数决定，这里 copies 指打印几遍完整脚本）
    for i in range(copies):
        try:
            send_bytes_to_printer(printer_name, data)
            steps.append("[copy %d] OK" % (i + 1))
        except PrinterError as exc:
            steps.append("[copy %d] FAIL: %s" % (i + 1, exc))
            return {"ok": False, "dryRun": False, "copies": copies, "bytes": len(data),
                    "steps": steps, "hexHead": hex_head, "error": str(exc), "win32Code": exc.win32_code}
        except Exception as exc:
            steps.append("[copy %d] EXCEPTION: %s" % (i + 1, exc))
            return {"ok": False, "dryRun": False, "copies": copies, "bytes": len(data),
                    "steps": steps, "hexHead": hex_head, "error": "发送异常：%s" % exc}

    return {"ok": True, "dryRun": False, "copies": copies, "bytes": len(data),
            "steps": steps, "hexHead": hex_head}


# ============== 列打印机 ==============
def list_printers() -> Dict[str, Any]:
    """列出系统打印机 + 默认打印机 + USB 打印机硬件ID（用于型号自动探测）。

    用 PowerShell Get-CimInstance Win32_Printer + Win32_PnPEntity（与 dprinter-web printer.js 一致），
    避免依赖 pywin32。失败返回空列表 + error。
    """
    ps = (
        '$ErrorActionPreference="SilentlyContinue";'
        '$all=Get-CimInstance -ClassName Win32_Printer | Select-Object Name,Default;'
        '$d=($all | Where-Object {$_.Default -eq $true} | Select-Object -First 1).Name;'
        '$names=($all | ForEach-Object {$_.Name}) -join "|";'
        # USB 打印机硬件ID（USBPRINT\...），用于型号自动探测
        '$usb=(Get-CimInstance -ClassName Win32_PnPEntity | '
        'Where-Object {$_.PNPDeviceID -like "USBPRINT\\*"} | '
        'ForEach-Object {$_.PNPDeviceID}) -join "|";'
        'Write-Output ("DEFAULT="+$d);'
        'Write-Output ("NAMES="+$names);'
        'Write-Output ("USBIDS="+$usb);'
    )
    try:
        # 用 System32 的 PowerShell（64 位，与 Python 位数无关）
        # PowerShell stdout 默认是系统 ANSI 代码页（中文 Windows 是 GBK/936），
        # 不能用 text=True（默认 utf-8 解码会因中文打印机名乱码失败），
        # 改成拿 bytes 再按 mbcs 解码。
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
            capture_output=True, timeout=15,
        )
    except Exception as exc:
        return {"defaultPrinter": "", "printers": [], "usbIds": [], "error": "调用 PowerShell 失败：%s" % exc}

    stdout = (result.stdout or b"").decode("mbcs", errors="replace")

    default_printer = ""
    printers: List[str] = []
    usb_ids: List[str] = []
    for line in stdout.splitlines():
        line = line.strip()
        if line.startswith("DEFAULT="):
            default_printer = line[8:].strip()
        elif line.startswith("NAMES="):
            rest = line[6:]
            for name in rest.split("|"):
                name = name.strip()
                if name:
                    printers.append(name)
        elif line.startswith("USBIDS="):
            rest = line[7:]
            for uid in rest.split("|"):
                uid = uid.strip()
                if uid:
                    usb_ids.append(uid)
    return {"defaultPrinter": default_printer, "printers": printers, "usbIds": usb_ids}


if __name__ == "__main__":
    # 命令行自检：python raw_printer.py
    info = list_printers()
    print("默认打印机:", info.get("defaultPrinter"))
    print("打印机列表:", info.get("printers"))
