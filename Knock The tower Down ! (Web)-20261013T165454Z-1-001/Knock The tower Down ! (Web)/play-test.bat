@echo off
title Knock the Tower Down - Playtest
cd /d "%~dp0"

echo ============================================
echo  KNOCK THE TOWER DOWN - playtest launcher
echo ============================================
echo   1 - Dev server        (instant reload, src/)
echo   2 - Build + preview   (production build)
echo   3 - Build only        (dist/index.html)
echo   4 - Verify levels      (physics + solvability tests)
echo   Q - Quit
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found - install from https://nodejs.org/
    pause
    exit /b 1
)

set "choice="
set /p choice="Choose [1]: "
if not defined choice set choice=1

if /i "%choice%"=="1" goto dev
if /i "%choice%"=="2" goto preview
if /i "%choice%"=="3" goto build
if /i "%choice%"=="4" goto verify
if /i "%choice%"=="q" exit /b 0
echo Unknown option.
pause
exit /b 1

:dev
if not exist "node_modules" (
    echo [INFO] First run - installing dependencies...
    call npm install
    if errorlevel 1 ( echo [ERROR] npm install failed. & pause & exit /b 1 )
)
echo [INFO] Dev server: http://localhost:5173/  (Ctrl+C to stop)
start "" cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:5173/"
call npm run dev
goto end

:preview
echo [INFO] Building production bundle...
call npm run build
if errorlevel 1 ( echo [ERROR] Build failed. & pause & exit /b 1 )
echo [INFO] Preview: http://localhost:4173/  (Ctrl+C to stop)
start "" cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:4173/"
call npm run preview
goto end

:build
echo [INFO] Building production bundle...
call npm run build
if errorlevel 1 ( echo [ERROR] Build failed. & pause & exit /b 1 )
echo [OK] Build written to dist\index.html - double-click it to play offline.
pause
exit /b 0

:verify
call npm run validate
echo.
call npm run verify:endless
pause
exit /b 0

:end
echo.
echo Server stopped. Press any key to close.
pause >nul
