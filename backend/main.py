# [CORE-001] FastAPI App & Entry Point
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.api.router import router
from backend.exceptions import EliteAppException, ERROR_CODES
from backend.services.diagnostics import diagnostics
from backend.config import settings
from backend.services.license_service import LicenseService
import uvicorn
import traceback
import os

app = FastAPI(title="Bastbanpem Automator - Elite Stack")
license_svc = LicenseService()

@app.exception_handler(EliteAppException)
async def elite_exception_handler(request: Request, exc: EliteAppException):
    diagnostics.log_error(exc.code, exc.message, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={
            "error_code": exc.code,
            "message": exc.message,
            "explanation": ERROR_CODES.get(exc.code, "Unknown system error."),
            "details": exc.details
        },
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    diagnostics.log_error("RUNTIME-CRASH", str(exc), traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={
            "error_code": "RUNTIME-CRASH",
            "message": "A critical runtime error occurred.",
            "explanation": str(exc)
        },
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:1420",
        "http://localhost:8000",
        "tauri://localhost",
        "https://tauri.localhost"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [EXPERT-006] Unified App & Frontend Entry Point
app.include_router(router)

@app.get("/health")
def health_check():
    license_status = license_svc.validate_license()
    return {
        "status": "ok",
        "license": license_status.get("status"),
        "hwid": license_svc.get_machine_id()
    }

# Serve static assets from the 'dist' folder if it exists
DIST_PATH = os.path.join(settings.BASE_DIR, "dist")
if os.path.exists(DIST_PATH):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_PATH, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Allow API and specific routes to pass through
        if full_path.startswith("api/") or full_path.startswith("portal/") or full_path.startswith("docs/"):
            return None # FastAPI will handle via router
            
        file_path = os.path.join(DIST_PATH, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_PATH, "index.html"))

if __name__ == "__main__":
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
