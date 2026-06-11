@echo off
chcp 65001 >nul
title GLM Manga Translator

echo ========================================
echo    GLM Manga Translator - Starting...
echo ========================================
echo.

cd /d "%~dp0"

set "PY=C:\Users\Laptop\AppData\Local\Programs\Python\Python314-32\python.exe"

if exist "%PY%" goto :found

echo [WARN] Python 3.14 (32-bit) not found, trying default...
set "PY=python"

:found
echo [OK] Using: %PY%
echo [OK] Open browser: http://127.0.0.1:5000
echo.
"%PY%" app.py

pause
