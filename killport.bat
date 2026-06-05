@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: 检查是否传入了端口号
if "%~1"=="" (
    echo 用法: killport ^<端口号^>
    echo 示例: killport 8080
    exit /b 1
)

:: 验证端口号是否为数字
echo %~1| findstr /r "^[0-9][0-9]*$" >nul
if errorlevel 1 (
    echo [错误] 端口号必须是数字: %~1
    exit /b 1
)

set "PORT=%~1"

:: 检查端口范围
if %PORT% LSS 1 (
    echo [错误] 端口号必须在 1-65535 之间
    exit /b 1
)
if %PORT% GTR 65535 (
    echo [错误] 端口号必须在 1-65535 之间
    exit /b 1
)

echo [信息] 正在查找占用端口 %PORT% 的进程...

:: 查找占用该端口的 PID
set "FOUND=0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% "') do (
    set "PID=%%a"
    :: 跳过 0 (系统空闲进程)
    if "!PID!" NEQ "0" (
        :: 获取进程名
        set "PROCNAME="
        for /f "tokens=1" %%b in ('tasklist /FI "PID eq !PID!" /NH 2^>nul') do set "PROCNAME=%%b"
        echo [杀死] PID: !PID!  进程: !PROCNAME!
        taskkill /F /PID !PID! >nul 2>&1
        if !errorlevel! EQU 0 (
            echo [成功] 进程 !PID! (!PROCNAME!) 已被终止
        ) else (
            echo [失败] 无法终止进程 !PID! (!PROCNAME!)，可能需要管理员权限
        )
        set "FOUND=1"
    )
)

if "!FOUND!"=="0" (
    echo [信息] 端口 %PORT% 没有被任何进程占用
)

echo [完成]
endlocal
