# BAST-Automator: Project Intelligence Singleton

This is the **Consolidated Source of Truth**. Replaces architecture.md, patterns.md, and decisions.md.

---

## 1. System Architecture

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

### Module Responsibilities
- **[DATA] Data Engine**: Polars ingestion, location resolution [DATA-002], SQLite vault [DATA-003].
- **[DOCS] Document Intel**: PyMuPDF slicing, RapidOCR extraction, Address normalisation [DOCS-004].
- **[CORE] Infrastructure**: FastAPI app [CORE-001], Global Config [CORE-002], Hardware detectors.
- **[UIUX] Frontend**: Axios bridge [UIUX-001], Excel Workbench [UIUX-002], PDF Sync [UIUX-005].

---

## 2. Karpathy Pattern: Goal-Driven Execution

LLMs are exceptionally good at **Looping until Meeting Specific Goals**. We use "Verification-First" development:

1. **Declarative Goals**: Instead of "Fix bug X," we define "Bug X is fixed when test case Y produces Z."
2. **Success Criteria**: Every major feature implementation must start with a success-check definition.
3. **Looping**: If a test fails, the agent self-corrects without being told *how*—only that it missed the goal.

---

## 3. Coding Patterns & Mandates

### Backend (Simplicity First)
- **Config-Driven**: settings from `backend.config` only.
- **Async/Await**: Non-blocking I/O is mandatory for UI responsiveness.
- **Polars Lazy**: Scan/Filter/Collect. Never `read_csv` for large files.
- **Memory Guards**: Explicit `gc.collect()` after large PDF or OCR operations.

### Frontend (Surgical Precision)
- **Bridge Pattern**: ALL calls via `src/lib/api.ts`.
- **Neutral Palette**: neutrals only (Slate, Zinc). Follow `CLAUDE.md`.
- **Layout Stability**: Fixed overlays + Scroll locking during heavy data alignment [UIUX-010].

---

## 4. Data Intelligence & Repair

### [DOCS-004] Address Normalisation
- Resolves INAPROC PDF hyphenation and old province names via `wilayah_reference.json`.

### [DATA-010] Deep Healing Patterns
- **Phone Healing**: Restores truncated mobile digits (e.g., `53...` -> `0853...`).
- **Title Case Protocol**: Standardizes Indonesian bureaucratic prefixes.
- **Location Bridge**: Auto-resolution logic using 83k master records.

---

## 5. Architectural Decisions (ADR)
- **[ADR-001] Polars**: Speed + Memory efficiency for 4GB RAM target.
- **[ADR-002] Static Serving**: FastAPI (8000) serves `dist/` to unify binary packaging.
- **[ADR-003] Surgical Hydration**: 15-record chunks + 25ms yield to prevent UI freeze.

**VERIFICATION: If code is over-complicated, it violates ADR-001 and CLAUDE.md Principles.**
