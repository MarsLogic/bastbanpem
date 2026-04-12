from typing import Any, Dict, Optional

class EliteAppException(Exception):
    """
    Base Exception for all Bastbanpem Automator errors.
    """
    def __init__(self, code: str, message: str, details: Optional[Dict[str, Any]] = None):
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(self.message)

ERROR_CODES = {
    # System & Hardware
    "ELITE-HW-001": "Insufficient RAM detected for OCR high-precision mode.",
    "ELITE-HW-002": "CPU lacks required AVX instructions for ONNX Runtime.",
    
    # OCR & Vision
    "ELITE-OCR-404": "RapidOCR Engine failed to initialize models.",
    "ELITE-OCR-001": "Image preprocessing failed: Blue-channel isolation error.",
    "ELITE-OCR-002": "Confidence threshold not met for NIK extraction.",
    
    # Data & Polars
    "ELITE-DATA-001": "Polars Ingestion Error: Malformed Excel structure.",
    "ELITE-DATA-002": "Reconciliation Failure: No matching NIKs found in dataset.",
    "ELITE-DATA-003": "RapidFuzz Match Timeout: Dataset too large for fuzzy repair.",
    
    # Licensing
    "ELITE-LIC-001": "License file missing or inaccessible.",
    "ELITE-LIC-002": "Hardware ID mismatch: License locked to another device.",
    "ELITE-LIC-003": "License cryptographic corruption detected.",
    "ELITE-LIC-004": "License lifespan expired.",
    
    # Browser Automation
    "ELITE-AUTO-001": "Playwright Stealth initialization failed.",
    "ELITE-AUTO-002": "Government Portal connection timeout (Check Internet).",
    "ELITE-AUTO-003": "Form submission rejected by Portal validation."
}
