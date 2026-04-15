# BAST-Automator: Elite Distribution Workbench

BAST-Automator is a high-precision distribution and reconciliation tool designed for the Indonesian BANPEM (Bantuan Pemerintah) program. It ensures 100% data integrity between Excel distribution payloads and PDF contract "Ground Truth."

## The Tech Stack (Elite Workbench)
- **Shell:** Hybrid Native-Web via `PyWebView` (Edge Chromium engine).
- **Backend:** `FastAPI` (Async Python) on Port 8000.
- **Data Engine:** `Polars` (Blazing fast Lazy evaluation for 4GB RAM optimization).
- **Intelligence:** 
  - **PDF:** `PyMuPDF` (High-precision slicing & metadata extraction).
  - **OCR:** `RapidOCR` + `OpenCV` (Elite OCR Suite with Multi-Scale Inference & Spatial Binding).
  - **Automation:** `Playwright` (Portal Automation & Submission).
- **Frontend:** `React 19` + `Vite` + `shadcn/ui`.

## Elite OCR Suite (Indonesian KTP)
Our OCR implementation is "best of the best" for the Indonesian KTP, featuring:
- **Spatial Binding:** 2D coordinate geometry to link labels and multi-line values.
- **NIK Triangulation:** Cross-verifying Gender and DOB using 16-digit NIK checksums.
- **Multi-Scale Scaling:** 1.5x auto-retry logic for low-res handheld photos.
- **Location Repair:** Hierarchical fuzzy correction via master location database.

## Expert AI Co-Coding Protocol
This repository is optimized for **Stateless AI Development** (Free-tier friendly). It uses a "Logical ID" system to ensure perfect continuity between sessions.

### Logical ID Mapping (The Barcodes)
Every file is tagged with a barcode (e.g., `[DATA-001]`). 
- **[CORE]**: Infrastructure & Diagnostics.
- **[DATA]**: Polars Engine & SQLite Vault.
- **[DOCS]**: OCR & PDF Intelligence.
- **[UIUX]**: React Workbench.

### Mandatory Workflow for Contributors
1. **Pulse Check:** Every new session must run `rtk git log -n 1 && cat docs/internal/STATE.md`.
2. **Surgical Edits:** Use `grep_search` for Logical IDs before modifying code.
3. **Ripple Audit:** If you change a logic ID, you must check all related references to prevent breaking changes.

## Installation & Setup
1. Clone the repo: `git clone https://github.com/MarsLogic/bastbanpem.git`
2. Run `start.bat` (Windows) or `start.ps1` (PowerShell).
   - This will automatically create a `.venv`, install requirements, and start both Backend and Frontend.

---
**GOAL**: 100% Traceability. 4GB RAM Optimization. Zero Hallucinations.
