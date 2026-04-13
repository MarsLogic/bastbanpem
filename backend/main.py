# [CORE-001] FastAPI App & Entry Point
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.api.router import router
from backend.exceptions import EliteAppException, ERROR_CODES
from backend.services.diagnostics import diagnostics
from backend.config import settings
import uvicorn
import traceback

app = FastAPI(title="Bastbanpem Automator - Elite Stack")

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
