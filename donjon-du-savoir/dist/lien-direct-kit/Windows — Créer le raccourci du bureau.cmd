@echo off
chcp 65001 >nul
setlocal
set "HERE=%~dp0"
set "ICON=%HERE%donjon.ico"
set "JEU=https://claude.ai/code/artifact/e2127687-04c1-40c0-be43-f0e5f8b27205"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=[Environment]::GetFolderPath('Desktop'); $f=Join-Path $d 'Le Donjon du Savoir.url'; $c=\"[InternetShortcut]`nURL=$env:JEU`nIconFile=$env:ICON`nIconIndex=0`n\"; Set-Content -LiteralPath $f -Value $c -Encoding Default"
echo.
echo  Raccourci « Le Donjon du Savoir » cree sur le Bureau.
echo  Double-cliquez dessus : le jeu s'ouvre dans votre navigateur.
echo  (Gardez ce dossier : l'icone y est stockee.)
echo.
pause
