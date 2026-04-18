@echo off
REM Option 3: Debug Mode (Bypass License)
echo [1/3] Verifying Environment...
if not exist ".venv" (
    echo [ERROR] .venv not found. Running auto-repair...
    python -m venv .venv
    call .venv\Scripts\activate
    pip install -r requirements.txt
)
echo [2/3] Building Latest UI...
call npm run build
echo [3/3] Starting Elite Backend Service (DEBUG MODE)...
echo.
echo ====================================================
echo  ACCESS APPLICATION AT: http://127.0.0.1:8000
echo  (DEBUG MODE ACTIVE - License Bypassed)
echo  (If UI looks old, press CTRL+F5 to hard refresh)
echo ====================================================
echo.
set PYTHONPATH=.
set ELITE_DEBUG=True
.venv\Scripts\python.exe -m backend.main
pause
