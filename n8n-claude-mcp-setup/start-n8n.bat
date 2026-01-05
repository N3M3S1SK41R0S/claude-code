@echo off
REM Demarrer N8N sur Windows

echo.
echo ========================================
echo   Demarrage de N8N...
echo ========================================
echo.

set N8N_PORT=5678
set N8N_HOST=0.0.0.0
set N8N_PROTOCOL=http

echo N8N demarre sur http://localhost:5678
echo.
echo Appuyez sur Ctrl+C pour arreter N8N
echo.

n8n start
