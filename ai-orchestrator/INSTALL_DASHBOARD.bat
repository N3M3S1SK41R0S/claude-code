@echo off
title NEMESIS Dashboard Installer
cd /d "%~dp0"
echo.
echo ========================================
echo   NEMESIS Dashboard Installation
echo ========================================
echo.
python launch_dashboard_install.py
pause
