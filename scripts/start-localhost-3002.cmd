@echo off
setlocal

cd /d "%~dp0\.."
title EDECOOP Sorteos - Localhost 3002

echo.
echo Iniciando EDECOOP Sorteos en http://localhost:3002
echo.
echo Si ya hay un servidor activo en este puerto, cierre la ventana anterior.
echo.

start "" "http://localhost:3002/login"
npm.cmd run dev -- --hostname 0.0.0.0 --port 3002

pause
