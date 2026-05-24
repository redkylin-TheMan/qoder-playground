@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PY_CMD="

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
echo https://www.python.org/downloads/windows/
echo Then run: py -0p
pause
exit /b 2

:found_python
echo Starting local service with %PY_CMD% ...
%PY_CMD% "%~dp0backend\server.py"
set "EXIT_CODE=%ERRORLEVEL%"
if "%EXIT_CODE%"=="0" exit /b 0
echo.
echo Service exited with code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%

:try_python
py -%1-32 -c "import sys; sys.exit(0 if sys.maxsize < 4294967296 else 1)" >nul 2>nul
if errorlevel 1 exit /b 0
set "PY_CMD=py -%1-32"
exit /b 0
