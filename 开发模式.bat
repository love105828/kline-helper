@echo off
chcp 65001 >nul
title 缠论助手 - 开发模式(热更新)
echo ============================================
echo   缠论助手 开发模式（改代码即时生效）
echo   网址: http://localhost:5173
echo   关闭此窗口即停止
echo ============================================
echo.

cd /d "%~dp0"
set PATH=D:\nodejs;%PATH%

start "" "D:\nodejs\node.exe" scripts\serve.mjs dist\build\h5 8090
start "" http://localhost:5173/
call npm run dev:h5
pause
