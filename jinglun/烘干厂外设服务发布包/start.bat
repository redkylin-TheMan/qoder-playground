@echo off
chcp 65001 >nul 2>nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "BACKEND_DIR=%~dp0运行文件\backend"
set "PY_CMD="
set "PYTHONW_PATH="

echo ========================================
echo  烘干厂外设服务 启动器
echo ========================================
echo.

REM ===== 1. 检测 32 位 Python =====
echo [步骤1] 检测 32 位 Python...
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

echo.
echo [错误] 未找到 32 位 Python
echo 请先安装: 安装文件\python-3.14.5.exe
echo 安装时勾选所有选项, 特别是 Add to PATH
echo 验证命令: py -0p
echo.
pause
exit /b 2

:found_python
echo [OK] 已找到 Python: !PY_CMD!

REM ===== 2. 检测 VC++ x86 运行库 =====
echo [步骤2] 检测 VC++ x86 运行库...
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x86" /v Installed >nul 2>nul
if not errorlevel 1 goto vc_ok
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x86" /v Installed >nul 2>nul
if not errorlevel 1 goto vc_ok

echo.
echo [错误] 未检测到 VC++ x86 运行库
echo 读卡 SDK 依赖此运行库, 请先安装: 安装文件\VC_redist.x86.exe
echo 安装完成后重新运行本脚本
echo.
pause
exit /b 2

:vc_ok
echo [OK] VC++ x86 运行库已安装

REM ===== 3. 关闭已有服务 =====
echo [步骤3] 检查并关闭已有服务...
call :stop_existing_service

REM ===== 4. 启动新服务 =====
echo [步骤4] 启动服务...
call :resolve_pythonw
if not exist "!PYTHONW_PATH!" goto no_pythonw

set "JINGLUN_START_BAT=%~f0"
start "" "!PYTHONW_PATH!" "!BACKEND_DIR!\tray_app.py"
echo.
echo [完成] 服务已启动, 请查看系统托盘图标
echo 诊断页: http://127.0.0.1:8765
echo 打印测试台: http://127.0.0.1:8765/print_test.html
echo.
timeout /t 3 >nul
exit /b 0

:no_pythonw
echo.
echo [错误] 找不到 pythonw.exe, 请重新安装 32 位 Python 并勾选所有选项
echo.
pause
exit /b 3


REM =============================================
REM :try_python - 检测指定版本的 32 位 Python
REM   注意: 用 goto 而非多行 if 块, 避免 cmd 括号解析陷阱
REM =============================================
:try_python
py -%1-32 -c "import sys; sys.exit(0 if sys.maxsize < 4294967296 else 1)" >nul 2>nul
if errorlevel 1 goto :eof
set "PY_CMD=py -%1-32"
goto :eof

REM =============================================
REM :resolve_pythonw - 定位 pythonw.exe
REM =============================================
:resolve_pythonw
set "PYTHONW_PATH="
set "PYTHONW_FILE=%TEMP%\jinglun_pythonw_path.txt"
!PY_CMD! -c "import os,sys; print(os.path.join(os.path.dirname(sys.executable),'pythonw.exe'))" > "%PYTHONW_FILE%" 2>nul
set /p PYTHONW_PATH=<"%PYTHONW_FILE%"
del "%PYTHONW_FILE%" >nul 2>nul
goto :eof

REM =============================================
REM :stop_existing_service - 优雅关闭已在运行的服务
REM   用独立 if + goto, 不用多行括号块
REM =============================================
:stop_existing_service
!PY_CMD! -c "import urllib.request; req=urllib.request.Request('http://127.0.0.1:8765/api/service/show-status', data=b'{}', headers={'Content-Type':'application/json'}, method='POST'); urllib.request.urlopen(req, timeout=1).read()" >nul 2>nul
if errorlevel 1 goto :eof

echo   检测到服务正在运行, 正在关闭旧服务...
!PY_CMD! -c "import urllib.request; req=urllib.request.Request('http://127.0.0.1:8765/api/service/shutdown', data=b'{}', headers={'Content-Type':'application/json'}, method='POST'); urllib.request.urlopen(req, timeout=3).read()" >nul 2>nul

echo   等待端口释放...
timeout /t 2 /nobreak >nul

REM 再次检测
!PY_CMD! -c "import urllib.request; req=urllib.request.Request('http://127.0.0.1:8765/api/service/show-status', data=b'{}', headers={'Content-Type':'application/json'}, method='POST'); urllib.request.urlopen(req, timeout=1).read()" >nul 2>nul
if errorlevel 1 goto service_stopped

echo   [警告] 优雅关闭失败, 尝试强制结束 pythonw.exe 进程...
taskkill /im pythonw.exe /f >nul 2>nul
timeout /t 1 /nobreak >nul

:service_stopped
echo   [OK] 旧服务已关闭
goto :eof
