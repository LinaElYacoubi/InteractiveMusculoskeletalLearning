@echo off
setlocal
cd /d "%~dp0"
"%~dp0web-app\runtime\node.exe" "%~dp0web-app\launch.mjs" --stop
if errorlevel 1 pause
