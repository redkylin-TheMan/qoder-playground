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
LOCAL_ALLOWED_ORIGINS = ("http://127.0.0.1", "http://localhost")


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
    print(f"精伦浏览器读卡服务已启动：{url}")
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
