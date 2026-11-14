@echo off
setlocal
cd /d "%~dp0"
"%~dp0web-app\runtime\node.exe" "%~dp0web-app\launch.mjs"
if errorlevel 1 pause
