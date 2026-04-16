@echo off
setlocal enabledelayedexpansion

:: ====================================================
::   BASTBANPEM AUTOMATOR - ELITE WORKBENCH COMMANDER
:: ====================================================
:: Version: 2.0.0 (Expert Stack)
:: Logic ID: [CORE-006]

:menu
cls
echo ====================================================
echo    BASTBANPEM AUTOMATOR - ELITE WORKBENCH
echo ====================================================
echo  [1] RUN PRODUCTION MODE (Recommended)
echo  [2] RUN DEVELOPER MODE (Vite + FastAPI)
echo  [3] RUN DEBUG MODE (Bypass License)
echo  --------------------------------------------------
echo  [L] LICENSE MANAGEMENT
echo  [P] FORENSIC SYSTEM PURGE (Factory Reset)
echo  [R] ENVIRONMENT REBUILD
echo  [D] SYSTEM DIAGNOSTICS
echo  [X] EXIT
echo ====================================================
set /p choice="Select Option: "

if "%choice%"=="1" goto run_prod
if "%choice%"=="2" goto run_dev
if "%choice%"=="3" goto run_debug
if "%choice%"=="L" goto license_menu
if "%choice%"=="l" goto license_menu
if "%choice%"=="P" goto purge_confirm
if "%choice%"=="p" goto purge_confirm
if "%choice%"=="R" goto rebuild
if "%choice%"=="r" goto rebuild
if "%choice%"=="D" goto diagnostics
if "%choice%"=="d" goto diagnostics
if "%choice%"=="X" goto end
if "%choice%"=="x" goto end
goto menu

:run_prod
echo [1/3] Verifying Environment...
call :verify_env
echo [2/3] Building Latest 'Expert' UI...
call npm run build
echo [3/3] Starting Elite Backend Service...
echo Access Application at: http://127.0.0.1:8000
set PYTHONPATH=.
.venv\Scripts\python.exe -m backend.main
pause
goto menu

:run_dev
echo [1/2] Launching Elite Backend...
start /B "Bastbanpem Backend" cmd /c "set PYTHONPATH=.&& .venv\Scripts\python.exe -m backend.main"
echo [2/2] Launching Vite Frontend...
npm run dev:frontend
goto menu

:run_debug
echo [1/3] Verifying Environment...
call :verify_env
echo [2/3] Checking Static Assets...
if not exist "dist\index.html" (
    echo [INFO] dist folder missing. Triggering manual build...
    call npm run build
)
echo [3/3] Starting Elite Backend Service (DEBUG MODE)...
echo Access Application at: http://127.0.0.1:8000
set PYTHONPATH=.
set ELITE_DEBUG=True
.venv\Scripts\python.exe -m backend.main
pause
goto menu

:license_menu
cls
echo ====================================================
echo    LICENSE MANAGEMENT
echo ====================================================
echo  [1] View Machine ID (HWID)
echo  [2] Generate Master Key (Admin)
echo  [B] Back to Main Menu
echo ====================================================
set /p lchoice="Select Option: "
if "%lchoice%"=="1" goto view_hwid
if "%lchoice%"=="2" goto gen_key
if "%lchoice%"=="B" goto menu
if "%lchoice%"=="b" goto menu
goto license_menu

:view_hwid
echo Retrieving unique machine fingerprint...
.venv\Scripts\python.exe -c "import sys, os; sys.path.append(os.getcwd()); from backend.services.license_service import LicenseService; print('\nMACHINE HWID: ' + LicenseService().get_machine_id())"
pause
goto license_menu

:gen_key
echo Launching Master Key Provisioning...
set PYTHONPATH=.
.venv\Scripts\python.exe -m backend.services.keygen
pause
goto license_menu

:purge_confirm
echo.
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo   WARNING: THIS WILL DELETE ALL LOCAL DATABASES,
echo   CACHED PORTAL SESSIONS, AND FORENSIC LOGS.
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
set /p pconfirm="Are you absolutely sure? (TYPE 'PURGE' to confirm): "
if "%pconfirm%"=="PURGE" goto run_purge
goto menu

:run_purge
echo Purging local vault...
if exist "bastbanpem_vault.db" del /Q bastbanpem_vault.db*
echo Purging portal sessions...
if exist "portal_session.json" del /Q portal_session.json
echo Purging cache and logs...
if exist "App_Data" rmdir /S /Q App_Data
if exist "forensic_diagnostics.log" del /Q forensic_diagnostics.log
if exist "__pycache__" rmdir /S /Q __pycache__
echo [SUCCESS] System is now clean.
pause
goto menu

:rebuild
echo Rebuilding Environment...
if exist ".venv" rmdir /S /Q .venv
python -m venv .venv
call .venv\Scripts\activate
pip install -r requirements.txt
echo Re-installing Node dependencies...
call npm install
echo [SUCCESS] Environment Rebuilt.
pause
goto menu

:diagnostics
echo Running Elite Health Check...
.venv\Scripts\python.exe tools\health_check.py
pause
goto menu

:verify_env
if not exist ".venv" (
    echo [ERROR] .venv not found. Running auto-repair...
    python -m venv .venv
    call .venv\Scripts\activate
    pip install -r requirements.txt
)
exit /b

:end
exit
