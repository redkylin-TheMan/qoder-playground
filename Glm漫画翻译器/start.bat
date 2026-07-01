@echo off
chcp 65001 >nul
title GLM Manga Translator

echo ========================================
echo    GLM Manga Translator - Starting...
echo ========================================
echo.

cd /d "%~dp0"

REM 优先使用项目虚拟环境
set "PY=.venv\Scripts\python.exe"

if exist "%PY%" goto :found

echo [WARN] Virtual environment not found, trying system Python...
set "PY=python"

:found
echo [OK] Using: %PY%
echo [OK] Open browser: http://127.0.0.1:5000
echo.

"%PY%" app.py

pause
