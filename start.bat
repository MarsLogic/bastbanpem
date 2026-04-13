@echo off
setlocal

echo [1/3] Checking Environment...
if not exist ".venv" (
    echo [ERROR] .venv not found. Creating virtual environment...
    python -m venv .venv
    call .venv\Scripts\activate
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate
    echo Checking for new dependencies...
    pip install -q -r requirements.txt
)

echo [2/3] Starting Elite Backend (FastAPI)...
start /B "Bastbanpem Backend" cmd /c "set PYTHONPATH=.&& .venv\Scripts\python.exe -m backend.main"

echo Waiting for backend to warm up...
timeout /t 3 /nobreak > nul

echo [3/3] Starting Workbench Interface (Vite)...
npm run dev:frontend

endlocal
