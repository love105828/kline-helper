@echo off
chcp 65001 >nul
title 缠论助手 - 本地网站
echo ============================================
echo   缠论助手(复刻版)
echo   网址: http://127.0.0.1:8090
echo   关闭此窗口即停止网站
echo ============================================
echo.

cd /d "%~dp0"

:: 先启动服务（延迟2秒再打开浏览器，等服务器就绪）
start "chanlun-server" /min cmd /c "D:\nodejs\node.exe scripts\serve.mjs dist\build\h5 8090"
timeout /t 2 >nul
start "" http://127.0.0.1:8090/

echo 网站已启动并打开浏览器。
echo 如果页面打不开，等2秒后刷新，或重新运行本脚本。
echo.
echo （此窗口可以关闭，网站在后台继续运行；
echo   要停止网站：任务管理器里结束 node.exe 进程）
pause >nul
