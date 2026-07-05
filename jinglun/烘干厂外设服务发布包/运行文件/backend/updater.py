"""烘干厂外设服务 自动更新模块.

由 tray_app.py 在启动后定时调用, 检查云端是否有新版本:
  1. GET {MANIFEST_BASE_URL}/drying/peripheral/manifest?currentVersion=x.y.z
  2. 比对版本号, 不同则弹窗提示用户
  3. 用户确认后: 下载 zip → 校验 SHA-256 → 备份当前 运行文件/ → 解压覆盖 → 重启服务

整个模块只用 Python 标准库, 不引入第三方依赖, 保证 32 位 Python 开箱即用.

更新范围: 整个 运行文件/ 目录 (backend/*.py + web/* + native/x86/*).
不动: 系统 Python/VC++、安装文件/、%APPDATA%/JinglunReader/settings.json.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
import tempfile
import urllib.request
import urllib.error
import urllib.parse
import zipfile
from pathlib import Path
from typing import Optional, Tuple


# 云端 manifest 接口基址. 现场客户端调此 URL 检查更新.
# 注意: 这里写完整 URL (含 /hl-drying 前缀), 生产部署时如换域名改这一处即可.
MANIFEST_BASE_URL = "https://hgc.liangyiagri.com/hl-drying"

# manifest 接口地址
MANIFEST_URL = MANIFEST_BASE_URL + "/drying/peripheral/manifest"

# HTTP 超时 (秒). 检查更新失败不影响业务, 失败就静默跳过.
HTTP_TIMEOUT = 8

# 下载超时 (秒). zip 包可能较大, 单独放宽.
DOWNLOAD_TIMEOUT = 120

# 本地 8765 服务的 shutdown 接口 (重启用)
LOCAL_SHUTDOWN_URL = "http://127.0.0.1:8765/api/service/shutdown"


def read_version(run_dir: Path) -> str:
    """读 运行文件/VERSION 文件. 不存在或读失败返回空串."""
    version_file = run_dir / "VERSION"
    try:
        if version_file.exists():
            return version_file.read_text(encoding="utf-8").strip()
    except Exception:
        pass
    return ""


def parse_semver(v: str) -> Optional[Tuple[int, int, int]]:
    """解析 x.y.z 三段数字. 失败返回 None."""
    if not v:
        return None
    parts = v.strip().split(".")
    if len(parts) != 3:
        return None
    try:
        return (int(parts[0]), int(parts[1]), int(parts[2]))
    except ValueError:
        return None


def is_newer(remote: str, current: str) -> bool:
    """remote > current 返回 True. 任一解析失败, 默认 False (不强制刷)."""
    r = parse_semver(remote)
    c = parse_semver(current)
    if r is None or c is None:
        return False
    return r > c


def fetch_manifest(current_version: str, logger=None) -> Optional[dict]:
    """调云端 manifest 接口.

    返回:
      - None: 网络错/接口错/无可用版本 (调用方静默忽略)
      - dict: {latestVersion, packageUrl, size, sha256, releaseNotes, publishedAt, forced}
              latestVersion 可能为 None (云端无 PUBLISHED 记录)
    """
    url = MANIFEST_URL + "?currentVersion=" + urllib.parse.quote(current_version or "")
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            raw = resp.read().decode("utf-8")
        payload = json.loads(raw)
    except urllib.error.URLError as e:
        if logger:
            logger("检查更新失败 (网络): " + str(e))
        return None
    except Exception as e:
        if logger:
            logger("检查更新失败 (解析): " + str(e))
        return None

    # 接口包了一层 {ok, data}; 取 data
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, dict):
        return None
    if data.get("latestVersion") is None:
        return None
    return data


def download_zip(url: str, expected_sha256: str, expected_size: int,
                 dest_path: Path, logger=None) -> bool:
    """流式下载 zip 到 dest_path, 边下边算 sha256, 下完校验.

    失败时删除临时文件, 返回 False.
    """
    tmp_path = dest_path.with_suffix(dest_path.suffix + ".part")
    sha = hashlib.sha256()
    total = 0
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT) as resp:
            with open(tmp_path, "wb") as f:
                while True:
                    chunk = resp.read(64 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)
                    sha.update(chunk)
                    total += len(chunk)
    except Exception as e:
        _safe_remove(tmp_path)
        if logger:
            logger("下载安装包失败: " + str(e))
        return False

    # 校验大小
    if expected_size and total != expected_size:
        _safe_remove(tmp_path)
        if logger:
            logger("安装包大小不匹配: 期望 " + str(expected_size) + ", 实际 " + str(total))
        return False

    # 校验 SHA-256
    actual = sha.hexdigest()
    if expected_sha256 and actual.lower() != expected_sha256.lower():
        _safe_remove(tmp_path)
        if logger:
            logger("安装包 SHA-256 校验失败: 期望 " + expected_sha256 + ", 实际 " + actual)
        return False

    try:
        os.replace(str(tmp_path), str(dest_path))
    except Exception as e:
        _safe_remove(tmp_path)
        if logger:
            logger("安装包落盘失败: " + str(e))
        return False
    return True


def apply_update(zip_path: Path, run_dir: Path, logger=None) -> bool:
    """应用更新: 备份 → 解压 → 校验 → 清缓存.

    zip 内部顶层必须是 运行文件/ 目录 (与发布包结构一致).
    任一步失败 → 回滚 (恢复 .bak).
    """
    import time

    if not zip_path.exists():
        if logger:
            logger("安装包不存在: " + str(zip_path))
        return False

    # 1. 备份当前 run_dir → 运行文件.bak.{ts}
    ts = time.strftime("%Y%m%d_%H%M%S")
    backup_dir = run_dir.parent / (run_dir.name + ".bak." + ts)
    try:
        shutil.move(str(run_dir), str(backup_dir))
    except Exception as e:
        if logger:
            logger("备份失败: " + str(e))
        return False

    # 2. 解压 zip 到 run_dir.parent (临时目录, 校验后再 rename)
    extract_tmp = run_dir.parent / (run_dir.name + ".new." + ts)
    try:
        with zipfile.ZipFile(str(zip_path), "r") as zf:
            zf.extractall(str(extract_tmp))
    except Exception as e:
        if logger:
            logger("解压失败: " + str(e))
        _rollback(backup_dir, run_dir, logger)
        _safe_rmtree(extract_tmp)
        return False

    # zip 顶层可能是 "运行文件/" 目录, 也可能直接是 backend/web/native
    # 找到含 VERSION 的目录作为真正的新 run_dir
    candidate = _find_run_dir_root(extract_tmp)
    if candidate is None or not (candidate / "VERSION").exists():
        if logger:
            logger("安装包结构错误: 顶层未找到 运行文件/VERSION")
        _rollback(backup_dir, run_dir, logger)
        _safe_rmtree(extract_tmp)
        return False

    # 3. 移动 candidate → run_dir
    try:
        shutil.move(str(candidate), str(run_dir))
    except Exception as e:
        if logger:
            logger("移动新版本失败: " + str(e))
        _rollback(backup_dir, run_dir, logger)
        _safe_rmtree(extract_tmp)
        return False

    # 4. 清理 __pycache__ (旧字节码会干扰新代码)
    pycache = run_dir / "backend" / "__pycache__"
    _safe_rmtree(pycache)

    # 5. 清理临时目录 + 保留最近 2 个 .bak
    _safe_rmtree(extract_tmp)
    _cleanup_old_backups(run_dir.parent, run_dir.name, keep=2, logger=logger)

    if logger:
        logger("更新已应用, 备份: " + backup_dir.name)
    return True


def restart_self(start_bat: Path, logger=None) -> None:
    """关停本机 8765 服务 + 启动新 start.bat + 自杀.

    必须在新进程里启 start.bat, 否则本进程退出会带走子进程.
    """
    import subprocess

    # 1. 通知本机 HTTP 服务关停 (非阻塞, 失败也继续, 下面会重启覆盖)
    try:
        req = urllib.request.Request(
            LOCAL_SHUTDOWN_URL,
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=2).read()
    except Exception:
        pass  # 服务可能已经在关; 不影响重启

    # 2. 启动新 start.bat (独立进程, 脱离本进程)
    try:
        subprocess.Popen(
            ["cmd", "/c", str(start_bat)],
            cwd=str(start_bat.parent),
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
            close_fds=True,
        )
    except Exception as e:
        if logger:
            logger("重启失败: " + str(e))
        return

    # 3. 自杀, 让出锁文件
    if logger:
        logger("重启中...")
    sys.exit(0)


# ============================================================
# 内部 helper
# ============================================================

def _safe_remove(path: Path) -> None:
    try:
        if path.exists():
            path.unlink()
    except Exception:
        pass


def _safe_rmtree(path: Path) -> None:
    try:
        if path.exists():
            shutil.rmtree(str(path), ignore_errors=True)
    except Exception:
        pass


def _rollback(backup_dir: Path, run_dir: Path, logger=None) -> None:
    """回滚: 把 backup_dir 移回 run_dir."""
    try:
        if run_dir.exists():
            _safe_rmtree(run_dir)
        if backup_dir.exists():
            shutil.move(str(backup_dir), str(run_dir))
        if logger:
            logger("已回滚到备份: " + backup_dir.name)
    except Exception as e:
        if logger:
            logger("回滚失败! 请手动恢复: " + str(backup_dir) + " → " + str(run_dir) + " : " + str(e))


def _find_run_dir_root(extract_root: Path) -> Optional[Path]:
    """在解压目录里找真正的运行根 (含 VERSION 文件)."""
    # 情况 1: extract_root/运行文件/VERSION
    for child in extract_root.iterdir() if extract_root.exists() else []:
        if child.is_dir() and (child / "VERSION").exists():
            return child
    # 情况 2: extract_root/VERSION (zip 直接打包运行文件内部)
    if (extract_root / "VERSION").exists():
        return extract_root
    return None


def _cleanup_old_backups(parent: Path, run_name: str, keep: int, logger=None) -> None:
    """保留最近 keep 个 .bak, 更老的删除. 按目录名时间戳排序."""
    prefix = run_name + ".bak."
    backups = sorted([p for p in parent.iterdir()
                      if p.is_dir() and p.name.startswith(prefix)],
                     key=lambda p: p.name)
    # 旧的在前, 删掉除最后 keep 个之外的
    for old in backups[:-keep] if keep > 0 else backups:
        _safe_rmtree(old)
        if logger:
            logger("清理旧备份: " + old.name)


# urllib.parse 模块加载 (放最后 import 避免 circular)

