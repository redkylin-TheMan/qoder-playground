@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

REM ===== 后端目录（开发版直接 backend，发布包在 运行文件\backend 下）=====
set "BACKEND_DIR=%~dp0运行文件\backend"

set "PY_CMD="
set "PYTHONW_PATH="

REM ===== 1. 检测 32 位 Python =====
call :try_python 3.14
if defined PY_CMD goto found_python
call :try_python 3.13
if defined PY_CMD goto found_python
call :try_python 3.12
if defined PY_CMD goto found_python
call :try_python 3.11
if defined PY_CMD goto found_python
call :try_python 3.10
if defined PY_CMD goto found_python
call :try_python 3.9
if defined PY_CMD goto found_python
call :try_python 3.8
if defined PY_CMD goto found_python

echo ========================================
echo  [错误] 未找到 32 位 Python
echo ========================================
echo 请先安装:
echo   安装文件\python-3.14.5.exe
echo 安装时务必勾选所有选项（特别是 Add to PATH）。
echo 验证: py -0p
pause
exit /b 2

:found_python
REM ===== 2. 检测 VC++ x86 运行库 =====
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x86" /v Installed >nul 2>nul
if errorlevel 1 (
  reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x86" /v Installed >nul 2>nul
)
if errorlevel 1 (
  echo ========================================
  echo  [警告] 未检测到 VC++ x86 运行库
  echo ========================================
  echo 读卡 SDK (Sdtapi.dll) 依赖此运行库。
  echo 请先安装:
  echo   安装文件\VC_redist.x86.exe
  echo 安装完成后重新运行本脚本。
  pause
  exit /b 2
)

REM ===== 3. 杀死已有服务（优雅关闭 → 等待 → 重启）=====
call :stop_existing_service

REM ===== 4. 启动新服务 =====
call :resolve_pythonw
if not exist "%PYTHONW_PATH%" goto no_pythonw

set "JINGLUN_START_BAT=%~f0"
start "" "%PYTHONW_PATH%" "%BACKEND_DIR%\tray_app.py"
exit /b 0

:no_pythonw
echo Cannot find pythonw.exe for %PY_CMD%.
echo Reinstall 32-bit Python and select all install options.
pause
exit /b 3

REM =============================================
REM :try_python — 检测指定版本的 32 位 Python
REM =============================================
:try_python
py -%1-32 -c "import sys; sys.exit(0 if sys.maxsize < 4294967296 else 1)" >nul 2>nul
if errorlevel 1 exit /b 0
set "PY_CMD=py -%1-32"
exit /b 0

REM =============================================
REM :stop_existing_service — 优雅关闭已在运行的服务
REM   先尝试 /api/service/shutdown，等 2 秒确认端口释放。
REM   如果 3 次请求都失败（服务卡死），提示用户手动 taskkill。
REM =============================================
:stop_existing_service
set "SERVICE_RUNNING="
%PY_CMD% -c "import urllib.request; req=urllib.request.Request('http://127.0.0.1:8765/api/service/show-status', data=b'{}', headers={'Content-Type':'application/json'}, method='POST'); urllib.request.urlopen(req, timeout=1).read()" >nul 2>nul
if errorlevel 1 exit /b 0
set "SERVICE_RUNNING=1"

echo 检测到服务已在运行，正在关闭旧服务...
%PY_CMD% -c "import urllib.request; req=urllib.request.Request('http://127.0.0.1:8765/api/service/shutdown', data=b'{}', headers={'Content-Type':'application/json'}, method='POST'); urllib.request.urlopen(req, timeout=3).read()" >nul 2>nul

REM 等 2 秒让端口释放
timeout /t 2 /nobreak >nul

REM 再次检测，如果还在跑说明 shutdown 失败
%PY_CMD% -c "import urllib.request; req=urllib.request.Request('http://127.0.0.1:8765/api/service/show-status', data=b'{}', headers={'Content-Type':'application/json'}, method='POST'); urllib.request.urlopen(req, timeout=1).read()" >nul 2>nul
if errorlevel 1 (
  echo 旧服务已关闭。
  exit /b 0
)

echo [警告] 优雅关闭失败，服务仍在运行。
echo 尝试强制结束 pythonw.exe 进程...
taskkill /im pythonw.exe /f >nul 2>nul
timeout /t 1 /nobreak >nul
exit /b 0

REM =============================================
REM :resolve_pythonw — 定位 pythonw.exe（无控制台窗口的 Python）
REM =============================================
:resolve_pythonw
set "PYTHONW_PATH="
set "PYTHONW_FILE=%TEMP%\jinglun_pythonw_path.txt"
%PY_CMD% -c "import os,sys; print(os.path.join(os.path.dirname(sys.executable),'pythonw.exe'))" > "%PYTHONW_FILE%" 2>nul
set /p PYTHONW_PATH=<"%PYTHONW_FILE%"
del "%PYTHONW_FILE%" >nul 2>nul
exit /b 0
