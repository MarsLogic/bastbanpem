# Master Logical ID Map: The "Barcodes" of BAST-Automator

Every code module and UI component is mapped to a unique ID. Use these for surgical audits and AI context isolation.

## 🏗️ [CORE] Infrastructure & Core Logic
- **`[CORE-001]`**: `backend/main.py` - FastAPI App & Entry Point
- **`[CORE-002]`**: `backend/config.py` - Global Settings Singleton
- **`[CORE-003]`**: `backend/services/diagnostics.py` - Forensic Logging & Diagnostics
- **`[CORE-004]`**: `backend/exceptions.py` - Custom Exception Framework
- **`[CORE-005]`**: `backend/services/hardware_orchestrator.py` - ONNX/RAM Auto-Detection
- **`[CORE-007]`**: `docs/internal/` - Persistence & Mapping Engine [MAP-001]

## 📊 [DATA] Data Engine & Excel Pipeline
- **`[DATA-001]`**: `backend/services/data_engine.py` - Polars Excel Ingestion & Logic
- **`[DATA-002]`**: `backend/services/location_service.py` - Master Location Resolver (83k entries)
- **`[DATA-003]`**: `backend/services/vault_service.py` - SQLite Contract Storage
- **`[DATA-004]`**: `backend/services/watcher_service.py` - File System Events for Ingestion

## 📄 [DOCS] PDF & Image Intelligence
- **`[DOCS-001]`**: `backend/services/pdf_service.py` - PyMuPDF Slicing & Report Generation
- **`[DOCS-002]`**: `backend/services/ktp_service.py` - RapidOCR Identity Extraction
- **`[DOCS-003]`**: `backend/services/pdf_intelligence.py` - Advanced Pattern Learning for PDFs

## 🤖 [AUTO] Portal Automation
- **`[AUTO-001]`**: `backend/services/automation_service.py` - Playwright Government Site Injection
- **`[AUTO-002]`**: `src/lib/assist_script.js` - Injected Bridge Script for Portal Forms

## 🎨 [UIUX] Workbench Frontend
- **`[UIUX-001]`**: `src/lib/api.ts` - Axios Backend Communication Bridge
- **`[UIUX-002]`**: `src/components/ExcelWorkbench.tsx` - Main Grid & Reconciliation Tab
- **`[UIUX-003]`**: `src/components/DocumentManager.tsx` - PDF Slicing UI
- **`[UIUX-004]`**: `src/components/ImageTaggerWorkspace.tsx` - OCR Tagging UI
- **`[UIUX-005]`**: `src/components/PdfSyncModule.tsx` - Ground Truth vs Excel Sync

---
**RIPPLE AUDIT RULE:** If you modify a `[DATA]` module, you MUST check all `[UIUX]` modules that call those endpoints in `[UIUX-001]`.
