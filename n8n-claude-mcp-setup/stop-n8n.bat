@echo off
REM Arreter N8N sur Windows

echo.
echo Arret de N8N...

taskkill /F /IM node.exe /FI "WINDOWTITLE eq n8n*" 2>nul
taskkill /F /IM n8n.exe 2>nul

echo N8N arrete.
pause
