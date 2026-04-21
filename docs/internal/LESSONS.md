# BASTBANPEM Lessons Learned: Forensic Repository

This document tracks architectural pitfalls, build regressions, and "gotchas" discovered during the development of the Elite Workbench.

## 🛠️ Build & Type Safety

### [LESSON-001] Synchronize API Return Types
- **Symptom**: `Property 'x' does not exist on type 'y'` in components using API results.
- **Cause**: Adding a new field to a backend response and the frontend fetch function implementation, but failing to update the TypeScript `Promise<Type>` return interface in the API bridge (`src/lib/api.ts`).
- **Fix**: Always update the `Promise<>` interface in `lib/api.ts` whenever the backend schema changes.

### [LESSON-002] Prop Destructuring Verification
- **Symptom**: `Cannot find name 'contract'` (or similar) when referencing props.
- **Cause**: Referencing a prop in the component body or hooks without adding it to the destructured arguments in the component definition.
- **Fix**: When adding logic that uses `contract` or `globalConfig`, verify they are listed in the `{ ... }` block of the component signature.

## 📊 Excel Ingestion

### [LESSON-003] Canonical Header Healing
- **Problem**: Fragmented headers like "insi" or "p r o v" breaking UI layouts.
- **Solution**: Implement a `canonical_heal` helper in `data_engine.py` using a robust `HEADER_ALIAS_MAP`. This ensures the UI always displays professional titles (**PROVINSI**) regardless of raw Excel quality.

### [LESSON-005] Ghost Variable Regression
- **Problem**: Backend crashing with `NameError: name 'df' is not defined` after refactoring.
- **Cause**: Using common variable names (like `df`) in a context where only specific ones (like `df_probe`) are defined. This often happens when porting logic between probing and ingestion phases.
- **Fix**: Always verify the available dataframe variable in the current function scope. In `probe_excel_structure`, use `df_probe`.

### [LESSON-006] Canonical Case Sensitivity
- **Problem**: Table displays headers but shows "0 rows captured" after a header refactor.
- **Cause**: The `HEADER_ALIAS_MAP` was updated to use uppercase canonical keys (e.g., `"NIK"`), but the ingestion logic was still looking up values using lowercase strings (e.g., `.get("nik")`). This caused the row validator to skip every row as "invalid" due to missing mandatory fields.
- **Fix**: Always synchronize the row processing logic (.get calls) with the keys defined in the alias map. If aliases change from "nik" to "NIK", all corresponding lookups must also change.

### [LESSON-007] Keyword Argument Duplication
- **Problem**: Backend failing to start with `SyntaxError: keyword argument repeated`.
- **Cause**: During refactoring of complex constructors (like `PipelineRow`), new property assignments were appended to the end of the call while old, partially-broken ones were still present at the top. Python does not allow repeating a keyword argument in the same function call.
- **Fix**: Before completing a refactor of a constructor call, perform a "Top-to-Bottom" scan to ensure every parameter is assigned exactly once.

## 📄 PDF Extraction

### [LESSON-004] Stanza-Aware Rendering
- **Problem**: SSKK legal text appearing blank despite successful extraction.
- **Solution**: The `ClauseRenderer` must be "Stanza-aware". Beautified legal text often has double-newlines between clauses. The regex parser must handle these breaks to avoid failing the match.

## 🖥️ UI & Expert UX

### [LESSON-008] Unnamed Header Suppression
- **Context**: Modern Excel parsers (Polars/fastexcel) often generate structural artifact headers for empty vertical columns (e.g., `UNNAMED: 0`, `Column_1`).
- **Fix**: Always filter discovery and final ingestion headers against a forensic blocklist. 
- Path: `backend/services/data_engine.py`
- Logic: `[h for h in headers if h != "UNNAMED"]` (where "UNNAMED" is the sentinel for artifacts).

### [LESSON-009] Unified Paginated Navigator (Elite Standard)
- **Context**: Forensic datasets require high-fidelity navigation.
- **Visual Rule**: All data tables MUST use the "Blue Reference" pagination style:
    1.  **Controls**: `<<`, `<`, `[ Input ] / Total`, `>`, `>>`
    2.  **Container**: `bg-white rounded-lg border border-slate-200 shadow-sm px-4 h-7`
    3.  **Separator**: Use a simple `/` divider (slate-300) instead of "PAGE" or "OF".
    4.  **Interaction**: Current page MUST be a borderless input within the container for direct jumping.
- **Consistency**: This pattern replaces the legacy "Page X of Y" labels across both Excel and PDF extraction modules.

### [LESSON-011] Icon Registry Verification
- **Context**: Adding new Lucide icons (e.g., `ChevronsLeft`, `FileDown`) requires double-checking imports.
- **Symptom**: Missing imports cause build errors (`TS2552`) that collapse the `dist` artifact.
- **Enforcement**: Always verify `lucide-react` import list after adding UI controls in `DataTableRenderer` or `DistributionIntelligence`.

### [LESSON-012] Universal Elite Data Table Blueprint
- **Context**: Forensic auditing requires deterministic, consistent data interaction regardless of the module (PDF extraction, Excel ingestion, etc).
- **The Blueprint**: Every data table created must include these 5 pillars as the "Default State":
    1.  **Search Bar**: Real-time filtering (Left-aligned).
    2.  **Export Excel**: High-fidelity export using `xlsx` library (Right-aligned in toolbar).
    3.  **Metadata Stats**: Display record count (e.g., `186 RECORDS`) and column count.
    4.  **Smart Sorting**: All headers clickable; logic must handle numeric/financial strings correctly (ascending/descending).
    5.  **Elite Pagination**:
        - **Navigation**: `<< < [Input] / Total > >>` pattern.
        - **Data Density**: `10 | 20 | 50 | All` selection in the footer.
- **Enforcement**: No "raw" tables allowed. Minimum viable data grid must implement all 5 pillars.

### [LESSON-013] Expert Data Healing (Excel)
- **Problem**: Spreadsheet imports often contain OCR mangling (e.g., "a Utara" instead of "Sumatera Utara").
- **Automatic Triangulation**: Use `masterDataStore.resolveHierarchy` instantly upon load to repair location fields.
- **In-Place Recovery**: Fix the data silently in the state so that search, filtering, and exports reflect standard "Golden" names rather than raw artifacts.
- **Implementation**: Map location headers dynamically using regex to avoid hardcoded column dependencies.

### [LESSON-014] Hierarchical Standardization (PDF Tables)
- **Problem**: PDF extractions (like SSKK) often miss levels (e.g., Kabupaten present but Province missing) or use inconsistent ordering.
- **Mandatory Order**: All forensic tables must lead with: `PROVINSI`, `KABUPATEN`, `KECAMATAN`, `DESA`.
- **Synthetic Injection**: If a level is missing from the raw PDF data, it must be virtually injected into the headers and populated via triangulation.
- **Benefit**: Ensures 100% geographical context and prevents audit fragmentation across different contract modules.

### [LESSON-016] Universal Sortable Index (#) Columns
- **Context**: Forensic users often sort by columns (e.g., QTY) but need a one-click way to "restore" the original document sequence.
- **Requirement**: ALL data tables must lead with a `#` (Index) column.
- **Logic**:
    1.  Assign a static `_idx` or `originalIdx` to every row during ingestion (1-indexed).
    2.  Make the `#` header clickable.
    3.  Clicking it triggers a sort by the static index, effectively resetting all other sorts.
- **Enforcement**: Never use the `(row, index)` from a `.map()` as the display index, as it will change when sorted. Always use the static source index.

### [LESSON-017] Professional Plain Language Policy
- **Core Directive**: Eliminate "AI-Marketing" and "Fancy" jargon from the UI.
- **Prohibited Words**: `Neuro-`, `Neural`, `Intelligence`, `Fidelity`, `Synthesizing`, `Vault`, `Predatory`.
- **Approved Replacements**:
    - `Intelligence` -> `Processing` or `Data`
    - `Neuro-Extraction` -> `PDF Extraction`
    - `Fidelity` -> `Accuracy`
    - `Vault` -> `Records` or `Data`
    - `Synthesizing` -> `Processing` or `Extracting`
    - `Intelligence Ingestion` -> `File Upload`
- **Goal**: Maintain a straightforward, professional, and action-oriented interface that focuses on accuracy and utility rather than marketing hype.
### [LESSON-018] Async Non-Blocking Processing (UI Performance)
- **Problem**: Heavy data alignment or "healing" logic iterating over hundreds of records can freeze the browser's main thread (UI Jitter/Hang).
- **Solution**: 
    1.  Convert intensive loops into `async` functions.
    2.  Use **Chunked Processing**: Process records in batches (e.g., 50-100) and yield control back to the main thread using `await new Promise(resolve => setTimeout(resolve, 0))`.
    3.  **Progress Visibility**: Provide clear, action-oriented progress feedback ("Processing 150 of 500 items...") instead of a generic, static spinner.
- **Goal**: Maintain 100% UI responsiveness (scrolling, clicking) even during "Expert Data Healing" operations.
