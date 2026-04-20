# [CORE-003] Forensic Logging & Diagnostics
import logging
import os
import sys
import json
from datetime import datetime
from typing import Any, Dict
from backend.config import settings

class EliteLogger:
    def __init__(self):
        self.log_file = settings.LOG_FILE
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s | %(levelname)s | %(message)s',
            handlers=[
                logging.FileHandler(self.log_file, encoding='utf-8'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger("EliteStack")

    def log_breadcrumb(self, category: str, message: str, data: Dict[str, Any] = None):
        """
        Elite Pattern: Track user actions and system state before an error occurs.
        """
        entry = {
            "timestamp": datetime.now().isoformat(),
            "category": category,
            "message": message,
            "metadata": data or {}
        }
        self.logger.info(f"BREADCRUMB | {category} | {message} | {json.dumps(data or {})}")

    def log_success(self, code: str, message: str):
        """
        Log a formal successful operation with code and state message.
        """
        self.logger.info(f"SUCCESS | {code} | {message}")

    def log_error(self, code: str, message: str, traceback: str = None):
        """
        Log a formal Elite error with code and optional stack trace.
        """
        self.logger.error(f"ERROR | {code} | {message}")
        if traceback:
            self.logger.error(f"TRACEBACK:\n{traceback}")

# Global Singleton
diagnostics = EliteLogger()
