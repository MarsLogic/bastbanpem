# BAST-Automator Architecture

This document explains how the system is structured. Every new AI session should read this first.

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                  React Frontend (Vite)                   │
│         (ExcelWorkbench, DocumentManager, etc)           │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP (Axios bridge: [UIUX-001])
                 ▼
┌─────────────────────────────────────────────────────────┐
│            FastAPI Backend (Port 8000)                   │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Data Engine  │  │ PDF/OCR      │  │ Automation   │  │
│  │ ([DATA])     │  │ ([DOCS])     │  │ ([AUTO])     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                   │                │            │
│         └───────────┬───────┴────────┬──────┘            │
│                     ▼                ▼                    │
│         ┌──────────────────────────────────┐             │
│         │  Vault Service ([DATA-003])      │             │
│         │  SQLite Contract Storage         │             │
│         └──────────────────────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

## Module Responsibilities

### Data Layer ([DATA-###])
- **[DATA-001]** data_engine.py — Polars Excel ingestion, lazy loading
- **[DATA-002]** location_service.py — Master location resolver (83k entries)
- **[DATA-003]** vault_service.py — SQLite contract storage, queries
- **[DATA-004]** watcher_service.py — File system events for auto-ingestion

**Key Pattern:** Polars lazy loading, explicit gc.collect(), context manager for resources

### Document Layer ([DOCS-###])
- **[DOCS-001]** pdf_service.py — PyMuPDF slicing, report generation
- **[DOCS-002]** ktp_service.py — RapidOCR identity extraction
- **[DOCS-003]** pdf_intelligence.py — Pattern learning, field extraction

**Key Pattern:** Async processing, batch operations, memory-efficient file handling

### Core Infrastructure ([CORE-###])
- **[CORE-001]** main.py — FastAPI app entry point
- **[CORE-002]** config.py — Global settings singleton (read here, don't hardcode)
- **[CORE-003]** diagnostics.py — Forensic logging
- **[CORE-004]** exceptions.py — Custom exception framework
- **[CORE-005]** hardware_orchestrator.py — ONNX/RAM detection
- **[CORE-007]** Persistence & Mapping Engine

**Key Pattern:** Dependency injection through config.py, custom exceptions for clarity

### Frontend Layer ([UIUX-###])
- **[UIUX-001]** api.ts — Axios bridge to backend (ALL backend calls go through here)
- **[UIUX-002]** ExcelWorkbench.tsx — Main grid, reconciliation tab
- **[UIUX-003]** DocumentManager.tsx — PDF slicing UI
- **[UIUX-004]** ImageTaggerWorkspace.tsx — OCR tagging
- **[UIUX-005]** PdfSyncModule.tsx — Ground truth vs Excel sync

**Key Pattern:** Always use [UIUX-001] for API calls, Tailwind styling, responsive design

## Data Flow Examples

### Example: Process New Excel File
```
File → [DATA-004] (watcher) → [DATA-001] (Polars ingestion) 
  → validate → [DATA-003] (vault storage) → UI update
```

### Example: Extract Data from PDF
```
PDF → [DOCS-001] (slice pages) → [DOCS-002] (OCR) 
  → [DOCS-003] (pattern learning) → [DATA-003] (store) → [UIUX-001] (show in UI)
```

### Example: UI to Backend Call
```
React Component → [UIUX-001] (api.ts call) → FastAPI endpoint 
  → [DATA-###] or [DOCS-###] → response → UI display
```

## Critical Rules (Enforced by AI)

1. **Memory Constraint:** 4GB RAM target
   - Use Polars lazy evaluation
   - Explicit `gc.collect()` after large operations
   - Context managers for file handles

2. **Async Pattern:** No blocking I/O
   - All I/O in FastAPI is async
   - Database calls are non-blocking
   - Heavy processing in background tasks

3. **Logical ID Ripple Rule:**
   - If you modify [DATA-###], check all [UIUX-###] endpoints that call it
   - If you modify [DOCS-###], verify [DATA-###] validators still work
   - Use `rtk rg "\[MODULE-ID\]"` before changing anything

4. **Config Pattern:**
   - Read from `backend/config.py`
   - Never hardcode settings
   - Environment variables → config.py → code

---

**When starting a new task, reference this architecture to understand data flow and module boundaries.**
