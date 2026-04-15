# [CORE-002] Global Settings Singleton
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API Settings
    API_HOST: str = "127.0.0.1"
    API_PORT: int = 8000
    
    # Path Settings
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR: str = os.path.join(BASE_DIR, "App_Data")
    MODELS_DIR: str = os.path.join(BASE_DIR, "models")
    LOG_FILE: str = os.path.join(BASE_DIR, "forensic_diagnostics.log")
    
    # Debug Settings
    ELITE_DEBUG: bool = os.getenv("ELITE_DEBUG", "False").lower() == "true"
    
    class Config:
        env_file = ".env"

settings = Settings()

# Ensure critical directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
