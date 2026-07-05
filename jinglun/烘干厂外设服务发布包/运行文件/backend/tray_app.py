from __future__ import annotations

import ctypes
import json
import os
import queue
import subprocess
import sys
import threading
import time
import webbrowser
import winreg
from ctypes import wintypes
from pathlib import Path
from tkinter import BOTH, END, LEFT, RIGHT, Button, Frame, Label, StringVar, Tk, Toplevel, messagebox
from tkinter.scrolledtext import ScrolledText
from typing import Any, Dict, List, Optional

from server import DEFAULT_PORT, HOST, bind_server


ROOT_DIR = Path(__file__).resolve().parents[1]
START_BAT = Path(os.environ.get("JINGLUN_START_BAT") or (ROOT_DIR / "start.bat"))
SETTINGS_DIR = Path(os.environ.get("APPDATA", str(ROOT_DIR))) / "JinglunReader"
SETTINGS_FILE = SETTINGS_DIR / "settings.json"
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
RUN_VALUE_NAME = "JinglunReader"
MAX_AUTOSTART_PROMPTS = 3


def now_text() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def load_settings() -> Dict[str, Any]:
    if not SETTINGS_FILE.exists():
        return {"autostartPromptAttempts": 0}
    try:
        return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"autostartPromptAttempts": 0}


def save_settings(settings: Dict[str, Any]) -> None:
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    SETTINGS_FILE.write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")


def autostart_command() -> str:
    return f'cmd.exe /c ""{START_BAT}""'


def is_autostart_enabled() -> bool:
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_READ) as key:
            value, _ = winreg.QueryValueEx(key, RUN_VALUE_NAME)
            return str(START_BAT) in value
    except FileNotFoundError:
        return False
    except OSError:
        return False


def set_autostart(enabled: bool) -> None:
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
        if enabled:
            winreg.SetValueEx(key, RUN_VALUE_NAME, 0, winreg.REG_SZ, autostart_command())
        else:
            try:
                winreg.DeleteValue(key, RUN_VALUE_NAME)
            except FileNotFoundError:
                pass


class TrayIcon:
    WM_TRAYICON = 0x0400 + 20
    WM_DESTROY = 0x0002
    WM_CLOSE = 0x0010
    WM_LBUTTONUP = 0x0202
    WM_LBUTTONDBLCLK = 0x0203
    WM_RBUTTONUP = 0x0205
    NIM_ADD = 0x00000000
    NIM_DELETE = 0x00000002
    NIF_MESSAGE = 0x00000001
    NIF_ICON = 0x00000002
    NIF_TIP = 0x00000004
    IDI_APPLICATION = 32512

    class WNDCLASS(ctypes.Structure):
        _fields_ = [
            ("style", wintypes.UINT),
            ("lpfnWndProc", ctypes.c_void_p),
            ("cbClsExtra", ctypes.c_int),
            ("cbWndExtra", ctypes.c_int),
            ("hInstance", wintypes.HINSTANCE),
            ("hIcon", wintypes.HICON),
            ("hCursor", wintypes.HCURSOR),
            ("hbrBackground", wintypes.HBRUSH),
            ("lpszMenuName", wintypes.LPCWSTR),
            ("lpszClassName", wintypes.LPCWSTR),
        ]

    class NOTIFYICONDATA(ctypes.Structure):
        _fields_ = [
            ("cbSize", wintypes.DWORD),
            ("hWnd", wintypes.HWND),
            ("uID", wintypes.UINT),
            ("uFlags", wintypes.UINT),
            ("uCallbackMessage", wintypes.UINT),
            ("hIcon", wintypes.HICON),
            ("szTip", wintypes.WCHAR * 128),
        ]

    def __init__(self, app: "JinglunTrayApp") -> None:
        self.app = app
        self.user32 = ctypes.windll.user32
        self.shell32 = ctypes.windll.shell32
        self.kernel32 = ctypes.windll.kernel32
        self.hwnd = None
        self.thread: Optional[threading.Thread] = None
        self._wndproc_ref = None

    def start(self) -> None:
        self.thread = threading.Thread(target=self._run, name="JinglunTrayIcon", daemon=True)
        self.thread.start()

    def stop(self) -> None:
        if self.hwnd:
            self.user32.PostMessageW(self.hwnd, self.WM_CLOSE, 0, 0)

    def _run(self) -> None:
        WNDPROC = ctypes.WINFUNCTYPE(wintypes.LRESULT, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)
        self._wndproc_ref = WNDPROC(self._wndproc)
        h_instance = self.kernel32.GetModuleHandleW(None)
        class_name = "JinglunReaderTrayWindow"

        wndclass = self.WNDCLASS()
        wndclass.lpfnWndProc = ctypes.cast(self._wndproc_ref, ctypes.c_void_p).value
        wndclass.hInstance = h_instance
        wndclass.lpszClassName = class_name
        self.user32.RegisterClassW(ctypes.byref(wndclass))

        self.hwnd = self.user32.CreateWindowExW(
            0,
            class_name,
            "JinglunReader",
            0,
            0,
            0,
            0,
            0,
            None,
            None,
            h_instance,
            None,
        )

        icon = self.user32.LoadIconW(None, self.IDI_APPLICATION)
        nid = self.NOTIFYICONDATA()
        nid.cbSize = ctypes.sizeof(self.NOTIFYICONDATA)
        nid.hWnd = self.hwnd
        nid.uID = 1
        nid.uFlags = self.NIF_ICON | self.NIF_MESSAGE | self.NIF_TIP
        nid.uCallbackMessage = self.WM_TRAYICON
        nid.hIcon = icon
        nid.szTip = "烘干厂外设服务"
        self.shell32.Shell_NotifyIconW(self.NIM_ADD, ctypes.byref(nid))
        self.app.append_log("托盘图标已启动")

        msg = wintypes.MSG()
        while self.user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
            self.user32.TranslateMessage(ctypes.byref(msg))
            self.user32.DispatchMessageW(ctypes.byref(msg))

        self.shell32.Shell_NotifyIconW(self.NIM_DELETE, ctypes.byref(nid))

    def _wndproc(self, hwnd: int, msg: int, wparam: int, lparam: int) -> int:
        if msg == self.WM_TRAYICON and lparam in (self.WM_LBUTTONUP, self.WM_LBUTTONDBLCLK, self.WM_RBUTTONUP):
            self.app.enqueue_ui(self.app.show_status)
            return 0
        if msg in (self.WM_CLOSE, self.WM_DESTROY):
            self.user32.DestroyWindow(hwnd)
            self.user32.PostQuitMessage(0)
            return 0
        return self.user32.DefWindowProcW(hwnd, msg, wparam, lparam)


class JinglunTrayApp:
    def __init__(self) -> None:
        self.root = Tk()
        self.root.title("烘干厂外设服务")
        self.root.withdraw()
        self.root.protocol("WM_DELETE_WINDOW", self.hide_status)

        self.settings = load_settings()
        self.httpd = None
        self.server_thread: Optional[threading.Thread] = None
        self.started_at = time.time()
        self.logs: List[str] = []
        self.ui_queue: "queue.Queue[Any]" = queue.Queue()
        self.status_window: Optional[Toplevel] = None
        self.settings_window: Optional[Toplevel] = None

        # [T-151] 自动更新: 当前版本号 + 更新中标志 (避免并发触发)
        import updater
        self.current_version = updater.read_version(ROOT_DIR)
        self.version_var = StringVar(value=self.current_version or "未知")
        self.update_in_progress = False
        self.status_var = StringVar(value="启动中")
        self.port_var = StringVar(value="-")
        self.autostart_var = StringVar(value="-")
        self.log_text: Optional[ScrolledText] = None
        self.tray = TrayIcon(self)

    def append_log(self, message: str) -> None:
        line = f"{now_text()}  {message}"
        self.logs.append(line)
        self.logs = self.logs[-300:]
        self.enqueue_ui(self.refresh_log_view)

    def enqueue_ui(self, func: Any) -> None:
        self.ui_queue.put(func)

    def poll_ui_queue(self) -> None:
        while True:
            try:
                func = self.ui_queue.get_nowait()
            except queue.Empty:
                break
            try:
                func()
            except Exception as exc:
                self.append_log(f"界面刷新失败：{exc}")
        self.root.after(200, self.poll_ui_queue)

    def start_server(self) -> None:
        self.httpd = bind_server(DEFAULT_PORT, control=self)
        host, port = self.httpd.server_address
        self.port_var.set(str(port))
        self.status_var.set(f"运行中：http://{host}:{port}")
        self.append_log(f"HTTP 服务已启动：http://{host}:{port}")
        self.server_thread = threading.Thread(target=self.httpd.serve_forever, name="JinglunHttpServer", daemon=True)
        self.server_thread.start()

    def status(self) -> Dict[str, Any]:
        host, port = self.httpd.server_address if self.httpd else (HOST, DEFAULT_PORT)
        return {
            "running": self.httpd is not None,
            "host": host,
            "port": port,
            "uptimeSeconds": int(time.time() - self.started_at),
            "autostartEnabled": is_autostart_enabled(),
            "logs": self.logs[-80:],
        }

    def show_status(self) -> None:
        if self.status_window and self.status_window.winfo_exists():
            self.status_window.deiconify()
            self.status_window.lift()
            self.refresh_status_vars()
            return

        win = Toplevel(self.root)
        win.title("烘干厂外设服务状态")
        win.geometry("760x520")
        win.protocol("WM_DELETE_WINDOW", self.hide_status)
        self.status_window = win

        top = Frame(win)
        top.pack(fill="x", padx=14, pady=12)
        Label(top, text="服务状态：").pack(side=LEFT)
        Label(top, textvariable=self.status_var).pack(side=LEFT)
        Label(top, text="  端口：").pack(side=LEFT)
        Label(top, textvariable=self.port_var).pack(side=LEFT)
        Label(top, text="  当前版本：").pack(side=LEFT)
        Label(top, textvariable=self.version_var).pack(side=LEFT)

        actions = Frame(win)
        actions.pack(fill="x", padx=14)
        Button(actions, text="打开诊断页", command=self.open_diagnostic_page).pack(side=LEFT, padx=(0, 8))
        Button(actions, text="检查更新", command=self.check_update_manual).pack(side=LEFT, padx=(0, 8))
        Button(actions, text="设置", command=self.show_settings).pack(side=LEFT, padx=(0, 8))
        Button(actions, text="关闭服务", command=self.confirm_shutdown).pack(side=RIGHT)

        self.log_text = ScrolledText(win, height=22)
        self.log_text.pack(fill=BOTH, expand=True, padx=14, pady=12)
        self.refresh_status_vars()
        self.refresh_log_view()

    def hide_status(self) -> None:
        if self.status_window and self.status_window.winfo_exists():
            self.status_window.withdraw()

    def refresh_status_vars(self) -> None:
        if self.httpd:
            host, port = self.httpd.server_address
            self.status_var.set(f"运行中：http://{host}:{port}")
            self.port_var.set(str(port))
        else:
            self.status_var.set("已停止")
            self.port_var.set("-")
        self.autostart_var.set("已开启" if is_autostart_enabled() else "未开启")

    def refresh_log_view(self) -> None:
        if not self.log_text or not self.log_text.winfo_exists():
            return
        self.log_text.delete("1.0", END)
        self.log_text.insert(END, "\n".join(self.logs))
        self.log_text.see(END)

    def open_diagnostic_page(self) -> None:
        if self.httpd:
            host, port = self.httpd.server_address
            webbrowser.open(f"http://{host}:{port}")

    def show_settings(self) -> None:
        if self.settings_window and self.settings_window.winfo_exists():
            self.settings_window.deiconify()
            self.settings_window.lift()
            return

        win = Toplevel(self.root)
        win.title("烘干厂外设服务设置")
        win.geometry("420x180")
        self.settings_window = win
        win.protocol("WM_DELETE_WINDOW", win.withdraw)

        Frame(win, height=10).pack()
        row = Frame(win)
        row.pack(fill="x", padx=18, pady=8)
        Label(row, text="开机自启：").pack(side=LEFT)
        Label(row, textvariable=self.autostart_var).pack(side=LEFT)

        buttons = Frame(win)
        buttons.pack(fill="x", padx=18, pady=12)
        Button(buttons, text="设置为开机自启", command=self.enable_autostart_from_settings).pack(side=LEFT, padx=(0, 8))
        Button(buttons, text="取消开机自启", command=self.disable_autostart_from_settings).pack(side=LEFT)
        self.refresh_status_vars()

    def enable_autostart_from_settings(self) -> None:
        try:
            set_autostart(True)
            self.settings["autostartPromptAttempts"] = 0
            save_settings(self.settings)
            self.refresh_status_vars()
            messagebox.showinfo("烘干厂外设服务", "已设置为开机自启。")
        except OSError as exc:
            messagebox.showerror("烘干厂外设服务", f"设置开机自启失败：{exc}")

    def disable_autostart_from_settings(self) -> None:
        try:
            set_autostart(False)
            self.refresh_status_vars()
            messagebox.showinfo("烘干厂外设服务", "已取消开机自启。")
        except OSError as exc:
            messagebox.showerror("烘干厂外设服务", f"取消开机自启失败：{exc}")

    def maybe_prompt_autostart(self) -> None:
        if is_autostart_enabled():
            self.refresh_status_vars()
            return
        attempts = int(self.settings.get("autostartPromptAttempts", 0) or 0)
        if attempts >= MAX_AUTOSTART_PROMPTS:
            self.append_log("开机自启申请已达到 3 次，后续不再自动弹出")
            self.refresh_status_vars()
            return
        answer = messagebox.askyesno(
            "烘干厂外设服务",
            "是否将烘干厂外设服务设置为开机自启？\n未开启时，每次使用业务系统前都需要手动运行 start.bat。",
        )
        if answer:
            try:
                set_autostart(True)
                self.settings["autostartPromptAttempts"] = 0
                self.append_log("已设置开机自启")
            except OSError as exc:
                self.settings["autostartPromptAttempts"] = attempts + 1
                messagebox.showerror("烘干厂外设服务", f"设置开机自启失败：{exc}")
        else:
            self.settings["autostartPromptAttempts"] = attempts + 1
            self.append_log(f"用户暂未开启开机自启，累计 {self.settings['autostartPromptAttempts']} 次")
        save_settings(self.settings)
        self.refresh_status_vars()

    def confirm_shutdown(self) -> None:
        if not messagebox.askyesno("烘干厂外设服务", "确定要关闭烘干厂外设服务吗？"):
            return
        self.shutdown()

    def shutdown(self) -> None:
        self.append_log("正在关闭服务")
        if self.httpd:
            httpd = self.httpd
            self.httpd = None
            def stop_http() -> None:
                httpd.shutdown()
                httpd.server_close()

            threading.Thread(target=stop_http, daemon=True).start()
        self.tray.stop()
        self.enqueue_ui(lambda: self.root.after(400, self.root.quit))

    # ============================================================
    # [T-151] 自动更新
    # ============================================================

    # 启动后首次检查延迟 (30s) 和后续间隔 (6h)
    UPDATE_FIRST_DELAY_MS = 30 * 1000
    UPDATE_INTERVAL_MS = 6 * 3600 * 1000

    def _check_update_background(self) -> None:
        """后台线程: 调云端 manifest, 有新版本则 enqueue UI 弹窗."""
        if self.update_in_progress:
            return
        # 用户在 settings 里关了自动检查 → 跳过 (手动按钮不受此限)
        if not bool(self.settings.get("autoCheckUpdate", True)):
            self._reschedule_update_check()
            return

        def _worker() -> None:
            import updater
            current = updater.read_version(ROOT_DIR)
            self.current_version = current
            try:
                self.enqueue_ui(lambda: self.version_var.set(current or "未知"))
            except Exception:
                pass
            manifest = updater.fetch_manifest(current, logger=self.append_log)
            if manifest is None:
                self._reschedule_update_check()
                return
            latest = manifest.get("latestVersion")
            if not latest:
                self._reschedule_update_check()
                return
            # 跳过用户主动忽略的版本 (避免反复弹)
            skipped = self.settings.get("skippedVersion")
            if not manifest.get("forced") and skipped == latest:
                self._reschedule_update_check()
                return
            if latest == current and not manifest.get("forced"):
                self._reschedule_update_check()
                return
            # 有新版本或强制更新 → UI 线程弹窗
            self.enqueue_ui(lambda: self._prompt_update(manifest))
            self._reschedule_update_check()

        threading.Thread(target=_worker, name="JinglunUpdater", daemon=True).start()

    def _reschedule_update_check(self) -> None:
        """6 小时后再检查一次."""
        try:
            self.root.after(self.UPDATE_INTERVAL_MS, self._check_update_background)
        except Exception:
            pass

    def check_update_manual(self) -> None:
        """状态窗口'检查更新'按钮: 立即检查 (忽略自动开关)."""
        if self.update_in_progress:
            messagebox.showinfo("烘干厂外设服务", "正在更新中，请稍候。")
            return
        self.append_log("手动检查更新...")
        # 直接调一次后台逻辑, 但绕过 autoCheckUpdate 开关
        saved = self.settings.get("autoCheckUpdate")
        self.settings["autoCheckUpdate"] = True
        try:
            self._check_update_background()
        finally:
            if saved is not None:
                self.settings["autoCheckUpdate"] = saved

    def _prompt_update(self, manifest: dict) -> None:
        """发现新版本 → 弹窗. forced 时只能升级."""
        latest = manifest.get("latestVersion") or ""
        notes = manifest.get("releaseNotes") or ""
        forced = bool(manifest.get("forced"))

        if forced:
            # 强制: 不可取消
            messagebox.showinfo(
                "烘干厂外设服务 - 必须升级",
                f"当前版本 {self.current_version or '未知'} 过低，必须升级到 {latest}。\n\n{notes}",
            )
            self._do_update(manifest)
            return

        # 非强制: 三选一 (立即升级 / 本次跳过 / 暂不)
        answer = messagebox.askyesnocancel(
            "烘干厂外设服务 - 发现新版本",
            f"新版本 {latest} 已发布。\n\n{notes}\n\n是否立即升级？\n（是=升级，否=跳过此版本，取消=下次再说）",
        )
        if answer is None:
            return  # 取消: 下次再说
        if answer is False:
            # 否: 记录跳过的版本, 不再弹 (除非强制)
            self.settings["skippedVersion"] = latest
            save_settings(self.settings)
            self.append_log(f"用户跳过版本 {latest}")
            return
        self._do_update(manifest)

    def _do_update(self, manifest: dict) -> None:
        """执行更新: 下载 → 应用 → 重启. 全程异步, 日志写状态窗口."""
        if self.update_in_progress:
            return
        self.update_in_progress = True

        latest = manifest.get("latestVersion") or ""
        package_url = manifest.get("packageUrl") or ""
        sha256 = manifest.get("sha256") or ""
        size = int(manifest.get("size") or 0)

        if not package_url:
            self.append_log("更新失败: 未拿到下载地址")
            self.update_in_progress = False
            return

        def _worker() -> None:
            import updater
            import tempfile
            try:
                # 1. 下载到临时目录
                tmp_dir = Path(tempfile.gettempdir())
                zip_path = tmp_dir / ("jinglun_peripheral_" + latest + ".zip")
                self.append_log(f"开始下载 {latest} ({size} bytes)...")
                ok = updater.download_zip(package_url, sha256, size, zip_path, logger=self.append_log)
                if not ok:
                    self.enqueue_ui(lambda: messagebox.showerror("烘干厂外设服务", f"下载 {latest} 失败，请稍后重试。"))
                    return
                self.append_log(f"下载完成, 开始应用更新...")

                # 2. 应用 (备份+解压+清缓存)
                ok = updater.apply_update(zip_path, ROOT_DIR, logger=self.append_log)
                if not ok:
                    self.enqueue_ui(lambda: messagebox.showerror("烘干厂外设服务", f"应用更新失败，已回滚。请检查日志。"))
                    return
                self.append_log("更新应用成功，即将重启服务...")

                # 3. 清理下载的 zip
                try:
                    zip_path.unlink()
                except Exception:
                    pass

                # 4. 重启 (会调本机 shutdown 接口 + 启动 start.bat + 自杀)
                self.enqueue_ui(lambda: updater.restart_self(START_BAT, logger=self.append_log))
            except Exception as e:
                self.append_log(f"更新异常: {e}")
                self.enqueue_ui(lambda: messagebox.showerror("烘干厂外设服务", f"更新异常: {e}"))
            finally:
                self.update_in_progress = False

        threading.Thread(target=_worker, name="JinglunUpdateApply", daemon=True).start()

    def run(self) -> int:
        try:
            self.start_server()
        except Exception as exc:
            messagebox.showerror("烘干厂外设服务", f"启动服务失败：{exc}")
            return 1
        try:
            self.tray.start()
        except Exception as exc:
            self.append_log(f"托盘启动失败：{exc}")
        self.root.after(200, self.poll_ui_queue)
        if os.environ.get("JINGLUN_SKIP_AUTOSTART_PROMPT") != "1":
            self.root.after(800, self.maybe_prompt_autostart)
        # [T-151] 启动 30s 后检查更新, 之后每 6h 一次
        self.root.after(self.UPDATE_FIRST_DELAY_MS, self._check_update_background)
        self.root.mainloop()
        return 0


def main() -> int:
    app = JinglunTrayApp()
    return app.run()


if __name__ == "__main__":
    raise SystemExit(main())
