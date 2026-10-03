@echo off
title Contact Connect Hub

cd /d "%~dp0"

REM Start backend
start "Contact Connect Hub Backend" /D "%~dp0backend" cmd /k "node server.js"

REM Start frontend
start "Contact Connect Hub Frontend" /D "%~dp0" cmd /k "node start-frontend.js"

REM Wait for servers
timeout /t 4 /nobreak >nul

REM Open Contact Connect Hub
start "" "http://127.0.0.1:5500/frontend/index.html"

exit