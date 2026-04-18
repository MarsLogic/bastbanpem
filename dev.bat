@echo off
REM Option 2: Developer Mode (Vite + FastAPI)
REM CRITICAL: Always rebuild first
echo [1/3] Building Frontend...
call npm run build
echo [2/3] Launching Elite Backend...
start /B "Bastbanpem Backend" cmd /c "set PYTHONPATH=.&& .venv\Scripts\python.exe -m backend.main"
echo [3/3] Launching Vite Frontend...
echo.
echo ====================================================
echo  ACCESS APPLICATION AT: http://localhost:5173
echo  (Changes will reflect immediately via Vite hot-reload)
echo ====================================================
echo.
npm run dev:frontend
pause
