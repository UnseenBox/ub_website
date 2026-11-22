@echo off
setlocal EnableExtensions
title Dig and Discover - Build and Play
cd /d "%~dp0"

echo.
echo   DIG ^& DISCOVER - build and play
echo   --------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 goto NoNode
where npm >nul 2>nul
if errorlevel 1 goto NoNode

echo [1/3] Checking dependencies...
if exist "node_modules\phaser\package.json" if exist "node_modules\vite\package.json" goto Build
echo       Installing (first run only, needs internet)...
call npm install --no-audit --no-fund
if errorlevel 1 goto Fail

:Build
echo.
echo [2/3] Building the CrazyGames BASIC build (dream, daily goals, monthly bank payment, extra saws)...
call npm run build:crazygames-basic
if errorlevel 1 goto Fail

echo.
echo [3/3] Starting local server and opening your browser...
echo       The dream only plays on a brand-new game: use the in-game Start over, or open a private window.
echo       Keep this window open while playing. Close it (or press Ctrl+C) to stop.
echo.
call npx vite preview --outDir dist-crazygames-basic --open
goto End

:NoNode
echo ERROR: Node.js was not found.
echo Install Node.js 18 or newer from https://nodejs.org/ and run this file again.
echo.
pause
exit /b 1

:Fail
echo.
echo ERROR: Something went wrong. See the messages above.
echo.
pause
exit /b 1

:End
echo.
echo Server stopped.
pause
exit /b 0
