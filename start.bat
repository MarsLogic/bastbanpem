@echo off
setlocal

echo ===========================================
echo    BAST-Automator 2025: Auto-Environment
echo ===========================================
echo.

echo [INFO] Preparing environment...

:: Force npm install just to be sure (it's fast if already done)
call npm install

:: Check for cargo and run start
echo [INFO] Launching app...
call npm run start

echo.
echo Process finished.
pause
