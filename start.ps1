Write-Host "[1/3] Checking Environment..." -ForegroundColor Cyan
if (-not (Test-Path ".venv")) {
    Write-Host "[ERROR] .venv not found. Creating virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
    & .venv\Scripts\Activate.ps1
    pip install -r requirements.txt
} else {
    & .venv\Scripts\Activate.ps1
    Write-Host "Checking for new dependencies..." -ForegroundColor Gray
    pip install -q -r requirements.txt
}

Write-Host "[2/3] Starting Elite Backend (FastAPI)..." -ForegroundColor Cyan
Start-Process -NoNewWindow -FilePath "cmd" -ArgumentList "/c", "set PYTHONPATH=.&& .venv\Scripts\python.exe -m backend.main"

Write-Host "Waiting for backend to warm up..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "[3/3] Starting Workbench Interface (Vite)..." -ForegroundColor Cyan
npm run dev:frontend
