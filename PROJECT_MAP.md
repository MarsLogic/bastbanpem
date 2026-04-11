# BAST-Automator Complete Project Map

This document provides a structural and architectural overview of the BAST-Automator project.

## 🏗️ System Architecture
The application is a **Hybrid Desktop App** built with **Tauri v2**.
- **UI Layer**: React 19 + TypeScript + Tailwind CSS v4.
- **Native Layer**: Rust (Tauri) for secure file system access and OS integration.
- **Research Layer**: Python scripts used for pattern learning and regex calibration.

---

## 📂 Core Directory Structure

### 1. `/src` (Frontend Logic)
- **`/components`**: UI Components.
  - `PdfSyncModule.tsx`: The "Nerve Center" for PDF handling. Manages extraction and dual-pane views.
  - `ExcelWorkbench.tsx`: High-performance grid for Excel data manipulation and global deduplication.
  - `ReconciliationTab.tsx`: The audit interface comparing PDF vs. Excel.
  - `ContractDetailView.tsx`: The primary dashboard for a specific contract.
  - `DocumentManager.tsx`: Manages auxiliary files (BASTB, Lab reports).
- **`/lib`**: Core Business Logic.
  - `pdfContractParser.ts`: High-accuracy regex engine for Ministry of Agriculture PDFs.
  - `auditEngine.ts`: Logic for fuzzy name matching and quantity reconciliation.
  - `contractStore.ts`: LocalForage-backed state management for contracts.
  - `dataPipeline.ts`: Legacy/Fallback ingestion logic for Titik Bagi tables.
  - `excelParser.ts`: XLSX ingestion and "Magic Balance" financial math.
  - `normalization.ts`: Cleaners for Indonesian names, dates, and currency.

### 2. `/src-tauri` (Native Layer)
- `Cargo.toml`: Rust dependencies (Tauri, Filesystem plugins).
- `capabilities/default.json`: Permissions for file access and dialogs.

### 3. `/docs` (Intelligence & Documentation)
- **`/superpowers`**: Structured specs and implementation plans.
  - `/specs`: Architectural requirements.
  - `/plans`: Step-by-step implementation tasks with checkboxes.

### 4. `/scripts` & Root (Research & Automation)
- `pdf_pattern_learner.py`: Python research script that achieved 100% extraction accuracy.
- `repomix-output.xml`: A full XML snapshot of the codebase for AI context bootstrap.
- `ROADMAP.md`: The master task list for all AI agents.
- `SESSION_LOG.md`: Granular history of changes made in the current session.

---

## 🔄 Data Flow Map

1. **Ingestion Phase**:
   - **PDF**: `PdfSyncModule` -> `pdfContractParser` (extracts metadata & delivery blocks).
   - **Excel**: `ExcelWorkbench` -> `excelParser` (processes distribution matrix).

2. **Refinement Phase**:
   - **Normalization**: All data passes through `normalization.ts` to ensure "KLP TANI" vs "POKTAN" doesn't break matches.
   - **Correction**: User edits cells in `ExcelWorkbench`. `applyMagicBalance` fixes rounding errors.

3. **Validation Phase**:
   - **Deduplication**: `contractStore` calculates `globalNIKRegistry` across all contracts. `ExcelWorkbench` flags duplicates.
   - **Reconciliation**: `auditEngine` compares PDF delivery blocks against Excel rows and generates a match score.

4. **Bundling Phase (Upcoming)**:
   - Evidence pages are sliced from the main PDF and merged with the Audit Report.

5. **Injection Phase (Upcoming)**:
   - Validated data is pushed to the BASTBANPEM portal via native automation.

---

## 🛡️ Safety & Continuity
- **Git Protocol**: Every feature has a `feat/*` branch. Code is pushed to `MarsLogic/bastbanpem` after every verified task.
- **Master Files**: `ROADMAP.md` and `SESSION_LOG.md` MUST be read by every new agent.
