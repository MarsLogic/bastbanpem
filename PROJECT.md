# BAST-Automator: The Almanac (System Knowledge)

This is the **Consolidated Knowledge Base** for the BAST-Automator project. It contains the technical specifications, architectural patterns, and structural barcodes (Logical IDs) required for high-fidelity development.

---

## 1. Project Overview
BAST-Automator is a high-precision distribution and reconciliation tool designed for the Indonesian BANPEM (Bantuan Pemerintah) program. It ensures 100% data integrity between Excel distribution payloads and PDF contract "Ground Truth."

### Technical Stack
- **Shell**: Hybrid Native-Web via `PyWebView` (Edge Chromium engine).
- **Backend**: `FastAPI` (Async Python) on Port 8000.
- **Data Engine**: `Polars` (Lazy evaluation for 4GB RAM optimization).
- **Intelligence**: 
  - **PDF**: `PyMuPDF` (Slicing) + `pdfplumber` (Legal layout analysis).
  - **OCR**: `RapidOCR` + `OpenCV` (Spatial Binding & NIK Triangulation).
  - **Automation**: `Playwright` (Portal Injection).
- **Frontend**: `React 19` + `Vite` + `shadcn/ui`.

---

## 2. System Architecture

### High-Level Flow
```mermaid
graph TD
    A[Excel/PDF Source] --> B[Data Engine [DATA]]
    B --> C[Polars Lazy Ingestion]
    C --> D[Location Resolver [DATA-002]]
    D --> E[Vault SQLite [DATA-003]]
    E --> F[React Grid [UIUX]]
    
    G[Contract PDF] --> H[OCR Layer [DOCS]]
    H --> I[Pattern Intel [DOCS-003]]
    I --> J[Ground Truth Sync]
    J --> F
```

### Logical ID Mapping (The Barcodes)
To ensure perfect continuity in a stateless AI environment, the codebase uses a Barcode system:

- **[CORE] Infrastructure**: FastAPI app [CORE-001], Global Config [CORE-002], Hardware detectors.
- **[DATA] Data Engine**: Polars ingestion [DATA-001], Location resolution [DATA-002], SQLite vault [DATA-003].
- **[DOCS] Document Intelligence**: OCR extraction [DOCS-001], PDF slicing [DOCS-002], Address normalisation [DOCS-004].
- **[UIUX] Frontend**: Axios bridge [UIUX-001], Excel Workbench [UIUX-002], PDF Sync [UIUX-005].

---

## 3. Specialized Intelligence Modules

### [DOCS-001] Elite OCR Suite
- **Spatial Binding**: 2D coordinate geometry linking labels to multi-line values.
- **NIK Triangulation**: Cross-verifying Gender and DOB using 16-digit NIK checksums.
- **Multi-Scale Retry**: 1.5x auto-scaling for low-resolution captures.

### [DATA-010] Deep Healing Patterns
- **Phone Healing**: Restores truncated mobile prefixes (e.g., `08...`).
- **Location Bridge**: Auto-resolution using 83k master Indonesian location records.
- **Title Case Protocol**: Standardizes bureaucratic prefixes (PT., CV., etc.).

---

## 4. Architectural Decisions (ADR)
- **[ADR-001] Polars Only**: Mandatory for 4GB RAM target. Never use `pandas`.
- **[ADR-002] Static Serving**: FastAPI (8000) serves `dist/` to unify binary packaging.
- **[ADR-003] Surgical Hydration**: 15-record chunks + 25ms yield to prevent UI freeze.
- **[ADR-004] Weighted Resolver**: Priority-based header matching (Highest Specificity Wins).

---

## 5. Reference Links
- **Operational Rules**: [CLAUDE.md](file:///c:/Users/Wyx/bastbanpem/CLAUDE.md)
- **Active State**: [STATE.md](file:///c:/Users/Wyx/bastbanpem/STATE.md)
- **Institutional Memory**: [LESSONS.md](file:///c:/Users/Wyx/bastbanpem/LESSONS.md)
