# BAST-Automator: Architectural Blueprint

This document details the technical architecture and data models of the BAST-Automator "Elite Workbench."

## 🏗️ 1. System Topology
The application is a **Hybrid Native-Web Container**:
- **Outer Shell**: `PyWebView` (Python) - Loads the local Vite build. Uses Windows native Edge engine to save 200MB+ RAM vs Electron.
- **Intelligence Core**: `FastAPI` (Python) - Handles all "Heavy" logic: OCR, PDF slicing, and Excel engineering.
- **Visual Workbench**: `React 19` + `shadcn/ui` - A high-fidelity interface for human-in-the-loop verification.

## 📊 2. Canonical Data Models

### PipelineRow (The Unified Distribution Unit)
All distribution data MUST follow this schema in both Python (Pydantic) and TypeScript (Interface):
```python
{
    "id": "uuid-v4",
    "nik": "16-digit-string",
    "name": "CLEANED NAME",
    "location": {
        "provinsi": "STR", "kabupaten": "STR", 
        "kecamatan": "STR", "desa": "STR"
    },
    "financials": {
        "qty": 0.0, "unit_price": 0.0, "shipping": 0.0,
        "target_value": 0.0, "calculated_value": 0.0, "gap": 0.0
    },
    "is_synced": bool,
    "is_excluded": bool,
    "page_source": int # 1-based page index in PDF
}
```

## 🧠 3. Elite Logic Patterns

### A. Intelligent Ingestion (`data_engine.py`)
- **Header Heuristics**: Scans top 50 rows for keywords (`nik`, `nama`) to find the data start.
- **Scientific notation Protection**: Prevents Excel from corrupting NIKs (e.g., `3.2E+15` -> `320...`).
- **Merged Cell Smoothing**: Uses forward-fill to recover parent metadata (Provinsi/Kab) in nested rows.

### B. Location Repair (`location_service.py`)
- Uses a **Master Registry** (`master_locations.json`, 83k entries).
- Uses `RapidFuzz` on a `Polars` DataFrame to fix typos in Excel location columns.

### C. Evidence Bundling (`pdf_service.py`)
- Uses `PyMuPDF` (`fitz`) to slice physical pages from the master contract.
- Embeds KTP and Delivery photos into a consolidated PDF report for each recipient.

### D. Dual-Model OCR (`ktp_service.py`)
- **v4 Mobile**: For 4GB RAM speed.
- **v5 Server**: For 8GB+ RAM accuracy.
- **Blue-Channel Isolation**: Suppresses Indonesian KTP background patterns to improve character recognition.
