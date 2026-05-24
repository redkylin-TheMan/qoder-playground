@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PY_CMD="
set "PYTHONW_PATH="

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

echo Cannot find 32-bit Python.
echo Install "Windows installer (32-bit)" from:
echo .\安装文件\python-3.14.5.exe
echo Then run: py -0p
pause
exit /b 2

:found_python
call :show_existing
if "%SERVICE_RUNNING%"=="1" exit /b 0

call :resolve_pythonw
if not exist "%PYTHONW_PATH%" goto no_pythonw

set "JINGLUN_START_BAT=%~f0"
start "" "%PYTHONW_PATH%" "%~dp0运行文件\backend\tray_app.py"
exit /b 0

:no_pythonw
echo Cannot find pythonw.exe for %PY_CMD%.
echo Reinstall 32-bit Python and select all install options.
pause
exit /b 3

:try_python
py -%1-32 -c "import sys; sys.exit(0 if sys.maxsize < 4294967296 else 1)" >nul 2>nul
if errorlevel 1 exit /b 0
set "PY_CMD=py -%1-32"
exit /b 0

:show_existing
set "SERVICE_RUNNING="
%PY_CMD% -c "import urllib.request; req=urllib.request.Request('http://127.0.0.1:8765/api/service/show-status', data=b'{}', headers={'Content-Type':'application/json'}, method='POST'); urllib.request.urlopen(req, timeout=1).read()" >nul 2>nul
if errorlevel 1 exit /b 0
set "SERVICE_RUNNING=1"
exit /b 0

:resolve_pythonw
set "PYTHONW_PATH="
set "PYTHONW_FILE=%TEMP%\jinglun_pythonw_path.txt"
%PY_CMD% -c "import os,sys; print(os.path.join(os.path.dirname(sys.executable),'pythonw.exe'))" > "%PYTHONW_FILE%" 2>nul
set /p PYTHONW_PATH=<"%PYTHONW_FILE%"
del "%PYTHONW_FILE%" >nul 2>nul
exit /b 0