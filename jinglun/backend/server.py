from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import threading
import time
import traceback
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional

from jinglun_sdk import JinglunError, assert_runtime_ready, environment_health, get_sdk


ROOT_DIR = Path(__file__).resolve().parents[1]
WEB_DIR = ROOT_DIR / "web"
HOST = "127.0.0.1"
DEFAULT_PORT = 8765
LOCAL_ALLOWED_ORIGINS = (
    "http://127.0.0.1", "http://localhost",
    # 烘干厂业务域名（生产 HTTPS）— 前端跨域请求本机服务需在白名单内
    "https://hgc.liangyiagri.com",
)


def _json_bytes(payload: Dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def ok(data: Any = None) -> Dict[str, Any]:
    return {"ok": True, "data": data if data is not None else {}}


def fail(code: str, message: str, ret: Optional[int] = None) -> Dict[str, Any]:
    error: Dict[str, Any] = {"code": code, "message": message}
    if ret is not None:
        error["ret"] = ret
    return {"ok": False, "error": error}


def int_body(body: Dict[str, Any], key: str, default: int) -> int:
    value = body.get(key, default)
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise JinglunError("INVALID_REQUEST", f"{key} 必须是整数。") from exc


def key_type_value(value: Any) -> int:
    if value in (0x60, "0x60", "60", "A", "a", "KeyA", "keyA", "keya"):
        return 0x60
    if value in (0x61, "0x61", "61", "B", "b", "KeyB", "keyB", "keyb"):
        return 0x61
    raise JinglunError("INVALID_KEY_TYPE", "密钥类型必须是 KeyA 或 KeyB。")


class JinglunHandler(BaseHTTPRequestHandler):
    server_version = "JinglunBrowser/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        line = "[%s] %s" % (self.log_date_time_string(), fmt % args)
        if sys.stdout:
            sys.stdout.write(line + "\n")
        control = getattr(self.server, "control", None)
        if control and hasattr(control, "append_log"):
            control.append_log(line)

    def end_headers(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin.startswith(LOCAL_ALLOWED_ORIGINS):
            self.send_header("Access-Control-Allow-Origin", origin)
        else:
            self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        if self.path.startswith("/api/"):
            self.handle_api("GET")
            return
        self.serve_static()

    def do_POST(self) -> None:
        self.handle_api("POST")

    def read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            value = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise JinglunError("INVALID_JSON", "请求体不是有效 JSON。") from exc
        if not isinstance(value, dict):
            raise JinglunError("INVALID_JSON", "请求体必须是 JSON 对象。")
        return value

    def write_json(self, status: int, payload: Dict[str, Any]) -> None:
        data = _json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def handle_api(self, method: str) -> None:
        try:
            route = self.path.split("?", 1)[0]
            body = self.read_json() if method == "POST" else {}
            data = self.dispatch(method, route, body)
            self.write_json(HTTPStatus.OK, ok(data))
        except JinglunError as exc:
            self.write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": exc.to_dict()})
        except Exception as exc:
            traceback.print_exc()
            self.write_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                fail("INTERNAL_ERROR", f"服务内部错误：{exc}"),
            )

    def dispatch(self, method: str, route: str, body: Dict[str, Any]) -> Any:
        if method == "GET" and route == "/api/health":
            health = environment_health()
            if health["canLoadSdk"]:
                try:
                    sdk = get_sdk()
                    health.update(sdk.health())
                    health["sdkLoadError"] = None
                except JinglunError as exc:
                    health["sdkLoadError"] = exc.to_dict()
            return health

        if method == "GET" and route == "/api/service/status":
            control = getattr(self.server, "control", None)
            if control and hasattr(control, "status"):
                return control.status()
            return {
                "running": True,
                "host": self.server.server_address[0],
                "port": self.server.server_address[1],
            }

        if method == "POST" and route == "/api/service/show-status":
            control = getattr(self.server, "control", None)
            if control and hasattr(control, "show_status"):
                control.show_status()
                return {"shown": True}
            return {"shown": False}

        if method == "POST" and route == "/api/service/shutdown":
            control = getattr(self.server, "control", None)
            if control and hasattr(control, "shutdown"):
                control.shutdown()
                return {"stopping": True}
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return {"stopping": True}

        # ===== 三联针式打印（不需要读卡 SDK，独立分支） =====
        if route.startswith("/api/print/"):
            return self.dispatch_print(method, route, body)

        # ===== GDI 图形表格打印（与 ESC/P 完全独立，不影响字符打印） =====
        if route.startswith("/api/gdi/"):
            return self.dispatch_gdi(method, route, body)

        sdk = get_sdk()

        if method == "GET" and route == "/api/devices":
            return sdk.devices()

        if method == "POST" and route == "/api/device/open":
            port = int_body(body, "port", 1001)
            device_type = str(body.get("deviceType", "auto") or "auto")
            index_raw = body.get("index")
            index = None if index_raw in (None, "", 0, "0") else int_body(body, "index", 1)
            return sdk.open_device(port=port, device_type=device_type, index=index)

        if method == "POST" and route == "/api/device/close":
            return sdk.close_device()

        if method == "POST" and route == "/api/id-card/read":
            return sdk.read_id_card()

        if method == "POST" and route == "/api/nfc/find":
            return sdk.nfc_find()

        if method == "POST" and route == "/api/nfc/sn":
            return sdk.nfc_sn()

        if method == "POST" and route == "/api/nfc/read-block":
            return sdk.nfc_read_block(
                sid=int_body(body, "sid", 0),
                bid=int_body(body, "bid", 0),
                key_type=key_type_value(body.get("keyType", "A")),
                key_hex=str(body.get("key", "FFFFFFFFFFFF")),
            )

        if method == "POST" and route == "/api/nfc/write-block":
            return sdk.nfc_write_block(
                sid=int_body(body, "sid", 0),
                bid=int_body(body, "bid", 0),
                key_type=key_type_value(body.get("keyType", "A")),
                key_hex=str(body.get("key", "FFFFFFFFFFFF")),
                data_hex=str(body.get("data", "")),
                allow_trailer_write=bool(body.get("allowTrailerWrite", False)),
            )

        if method == "POST" and route == "/api/nfc/apdu":
            return sdk.nfc_apdu(str(body.get("apdu", "")))

        raise JinglunError("NOT_FOUND", f"未知接口：{method} {route}")

    def dispatch_print(self, method: str, route: str, body: Dict[str, Any]) -> Any:
        """针式打印路由分发。响应沿用 {ok, data} 约定。

        路由（业务用）：
          GET  /api/print/printers     列系统打印机 + 默认机 + USB硬件ID
          POST /api/print/preview      body {entry, docType, model?} → 预览模型 + hex（不打印）
          POST /api/print/triplicate   body {entry, docType, printerName, copies?, dryRun?, model?, font?} → 打印
          docType: grain_in | grain_out

        路由（测试台用）：
          GET  /api/print/models       返回打印机型号清单（得力全系 + 得实 DS-600T + 通用兜底）
          GET  /api/print/detect       USB 硬件ID 自动探测当前连接的打印机型号
          POST /api/print/doc          body {type, fields, font?, model?, printerName?, copies?, dryRun?}
                                       → 通用单据构建（fields 直传，5 种模板），预览或打印
          type: grainIn | grainOut | invoice | receipt | triplicate
        """
        import time

        import print_docs
        import raw_printer

        # GET /api/print/printers — 列打印机
        if method == "GET" and route == "/api/print/printers":
            return raw_printer.list_printers()

        # GET /api/print/models — 返回打印机型号清单（测试台用）
        if method == "GET" and route == "/api/print/models":
            import printer_models
            return {
                "models": printer_models.list_models(),
                "driverIndexPages": printer_models.DRIVER_INDEX_PAGES,
                "universalDrivers": printer_models.UNIVERSAL_DRIVERS,
            }

        # GET /api/print/detect — USB 硬件ID 自动探测型号（测试台用）
        if method == "GET" and route == "/api/print/detect":
            import printer_models
            info = raw_printer.list_printers()
            usb_ids = info.get("usbIds") or []
            detected_key = printer_models.detect_model(usb_ids)
            detected_model = printer_models.get_model(detected_key) if detected_key else None
            return {
                "detectedModel": detected_key,
                "detectedInfo": {
                    "key": detected_key,
                    "name": detected_model["name"],
                    "columns": detected_model["columns"],
                    "copies": detected_model["copies"],
                    "lineWidth": detected_model["lineWidth"],
                    "feedLines": detected_model["feedLines"],
                    "driverUrl": detected_model["driverUrl"],
                    "notes": detected_model["notes"],
                } if detected_model else None,
                "usbIds": usb_ids,
                "printers": info.get("printers") or [],
                "defaultPrinter": info.get("defaultPrinter") or "",
            }

        # POST /api/print/doc — 通用单据构建（测试台用，fields 直传）
        if method == "POST" and route == "/api/print/doc":
            import documents
            doc_type = str(body.get("type") or "")
            fields = body.get("fields") or {}
            model = body.get("model") or "DB-618KII"
            font = body.get("font") or None

            try:
                builder = documents.build_doc(doc_type, fields, font=font, model=model)
            except ValueError as exc:
                raise JinglunError("INVALID_DOC_TYPE", str(exc))
            script_lines = builder.to_script()
            data = raw_printer.build_bytes(script_lines)

            printer_name = str(body.get("printerName") or "")
            copies = int(body.get("copies") or 1)
            dry_run = bool(body.get("dryRun", True))  # 测试台默认 dryRun

            # 没指定打印机或 dryRun → 只返回预览 + hex
            if dry_run or not printer_name:
                return {
                    "dryRun": True,
                    "preview": builder.get_preview(),
                    "bytes": len(data),
                    "hexHead": " ".join("%02X" % c for c in data[:64]),
                }

            # 有打印机且非 dryRun → 实际打印
            result = raw_printer.send_script(script_lines, printer_name, copies=copies, dry_run=False)
            if not result.get("ok"):
                err = result.get("error") or "打印失败"
                code = "PRINTER_FAILED"
                ret = result.get("win32Code")
                raise JinglunError(code, err, ret)
            return {
                "dryRun": False,
                "copies": result["copies"],
                "bytes": result["bytes"],
                "steps": result["steps"],
                "hexHead": result.get("hexHead"),
                "preview": builder.get_preview(),
            }

        # 以下都是 POST，需要 docType
        doc_type = str(body.get("docType") or "")
        entry = body.get("entry") or {}
        model = body.get("model") or "DB-618KII"
        font = body.get("font") or None

        # 给 entry 补打印日期（前端没传就用今天）
        if not entry.get("printDate"):
            entry = dict(entry)
            entry["printDate"] = time.strftime("%Y-%m-%d")

        # 构建单据（共用一份指令，preview 和 print 都用）
        try:
            builder = print_docs.build_doc(doc_type, entry, font=font, model=model)
        except ValueError as exc:
            raise JinglunError("INVALID_DOC_TYPE", str(exc))
        script_lines = builder.to_script()

        # POST /api/print/preview — 只返回预览，不打印
        if method == "POST" and route == "/api/print/preview":
            data = raw_printer.build_bytes(script_lines)
            return {
                "preview": builder.get_preview(),
                "bytes": len(data),
                "hexHead": " ".join("%02X" % c for c in data[:64]),
            }

        # POST /api/print/triplicate — 实际打印
        if method == "POST" and route == "/api/print/triplicate":
            printer_name = str(body.get("printerName") or "")
            copies = int(body.get("copies") or 1)
            dry_run = bool(body.get("dryRun"))
            result = raw_printer.send_script(script_lines, printer_name, copies=copies, dry_run=dry_run)
            if not result.get("ok"):
                err = result.get("error") or "打印失败"
                code = "PRINTER_FAILED"
                ret = result.get("win32Code")
                raise JinglunError(code, err, ret)
            # 只返回 data 部分（外层 handle_api 会包 {ok:true, data:...}）
            return {
                "dryRun": result["dryRun"],
                "copies": result["copies"],
                "bytes": result["bytes"],
                "steps": result["steps"],
                "hexHead": result.get("hexHead"),
                "preview": builder.get_preview(),
            }

        raise JinglunError("NOT_FOUND", f"未知打印接口：{method} {route}")

    def dispatch_gdi(self, method: str, route: str, body: Dict[str, Any]) -> Any:
        """GDI 图形表格打印路由（与 ESC/P 的 /api/print/* 完全独立，互不影响）。

        路由：
          GET  /api/gdi/papers   返回纸张预设清单（7.5cm 三联纸等）
          POST /api/gdi/preview  body {entry, docType, model?, font?} → 布局 + 预览（不打印）
          POST /api/gdi/print    body {entry, docType, printerName, copies?, dryRun?, model?, font?, paperMm?}
                                 → GDI 渲染打印
          docType: grain_in | grain_out

        与 ESC/P 的区别：GDI 走 Windows 图形驱动渲染实线表格（像 Excel），
        不产出 hexHead（无原始字节流概念），改用 bytes=格子数。
        """
        import gdi_docs
        import gdi_tables

        # GET /api/gdi/papers — 纸张预设清单
        if method == "GET" and route == "/api/gdi/papers":
            return {"papers": gdi_tables.PAPER_PRESETS}

        # POST 路由需要 docType + entry
        doc_type = str(body.get("docType") or "")
        entry = body.get("entry") or {}
        model = body.get("model") or "DB-618KII"
        font = body.get("font") or None

        if not entry.get("printDate"):
            entry = dict(entry)
            entry["printDate"] = time.strftime("%Y-%m-%d")

        # 构建 Table 模型 + 预览（preview/print 共用）
        try:
            table, preview = gdi_docs.build_doc(doc_type, entry, font=font, model=model)
        except ValueError as exc:
            raise JinglunError("INVALID_DOC_TYPE", str(exc))

        # POST /api/gdi/preview — 只返回预览，不打印
        if method == "POST" and route == "/api/gdi/preview":
            paper_key = str(body.get("paperKey") or "75x100")
            paper_mm = gdi_tables.resolve_paper(paper_key)
            page_w_mm = paper_mm[0] if paper_mm else 75.0
            laid = gdi_tables.layout(table, dpi=180, page_w_mm=page_w_mm,
                                     font_default=float((font or {}).get("size", 9.0)))
            return {
                "preview": preview,
                "rows": len(laid.grid_cells),
                "cols": len(table.col_ratios),
                "cells": len(laid.rects),
                "widthPx": laid.width,
                "heightPx": laid.height,
            }

        # POST /api/gdi/print — GDI 渲染打印（dryRun 默认 False，测试台可显式传 True）
        if method == "POST" and route == "/api/gdi/print":
            printer_name = str(body.get("printerName") or "")
            copies = int(body.get("copies") or 1)
            dry_run = bool(body.get("dryRun", False))
            paper_key = str(body.get("paperKey") or "75x100")
            paper_mm = gdi_tables.resolve_paper(paper_key)

            result = gdi_docs.send(
                table, printer_name=printer_name, copies=copies, dry_run=dry_run,
                paper_mm=paper_mm, model=model, font=font, preview=preview,
            )
            if not result.get("ok"):
                err = result.get("error") or "GDI 打印失败"
                code = "GDI_FAILED"
                ret = result.get("win32Code")
                raise JinglunError(code, err, ret)
            return {
                "dryRun": result["dryRun"],
                "copies": result["copies"],
                "bytes": result["bytes"],  # GDI 没有字节流概念，这里是格子数
                "steps": result["steps"],
                "preview": result["preview"],
            }

        raise JinglunError("NOT_FOUND", f"未知 GDI 接口：{method} {route}")

    def serve_static(self) -> None:
        path = self.path.split("?", 1)[0]
        if path in ("", "/"):
            path = "/index.html"
        relative = path.lstrip("/")
        target = (WEB_DIR / relative).resolve()
        web_root = WEB_DIR.resolve()
        try:
            target.relative_to(web_root)
        except ValueError:
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return
        if not target.exists() or not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        content = target.read_bytes()
        mime, _ = mimetypes.guess_type(str(target))
        if mime is None:
            mime = "application/octet-stream"
        if target.suffix.lower() in (".html", ".css", ".js"):
            mime += "; charset=utf-8"

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


def bind_server(preferred_port: int, control: Optional[Any] = None) -> ThreadingHTTPServer:
    last_error: Optional[OSError] = None
    for port in range(preferred_port, preferred_port + 10):
        try:
            httpd = ThreadingHTTPServer((HOST, port), JinglunHandler)
            httpd.control = control
            httpd.started_at = time.time()
            return httpd
        except OSError as exc:
            last_error = exc
    raise RuntimeError(f"无法绑定 {HOST}:{preferred_port}-{preferred_port + 9}：{last_error}")


def open_browser_later(url: str) -> None:
    def _open() -> None:
        time.sleep(0.6)
        webbrowser.open(url)

    threading.Thread(target=_open, daemon=True).start()


def main() -> int:
    parser = argparse.ArgumentParser(description="精伦 iDR210 浏览器本机服务")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    try:
        assert_runtime_ready()
    except JinglunError as exc:
        print(exc.message, file=sys.stderr)
        print("运行 start.bat 会自动查找 32 位 Python。", file=sys.stderr)
        return 2

    httpd = bind_server(args.port)
    host, port = httpd.server_address
    url = f"http://{host}:{port}"
    print(f"烘干厂外设服务已启动：{url}")
    print("按 Ctrl+C 停止服务。")
    if not args.no_browser:
        open_browser_later(url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n正在停止服务...")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
