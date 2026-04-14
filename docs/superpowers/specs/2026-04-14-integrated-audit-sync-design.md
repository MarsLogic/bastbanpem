# Design Spec: Integrated Audit & Sync Workspace (2026-04-14)

## 1. Objective
Transform the BAST Automator from a set of disconnected extraction tools into an enterprise-grade compliance engine that reconciles local data (OCR, PDF, Excel) with the Government Portal (`bastbanpem.pertanian.go.id`).

## 2. Core Capabilities (Preserved)
The following expert-level tools are INTEGRATED, not replaced:
- **OCR Engine (`ktp-ocr-bridge.py`):** Extracts NIK/Nama from KTP images for portal registration.
- **PDF Parser (`pdfContractParser.ts`):** Extracts contract metadata (No, Date, Qty) as the baseline for reconciliation.
- **Excel Auditor (`excel-auditor.ts`):** Validates recipient lists against master data before portal submission.
- **PDF Splitter:** Segregates BASTB and Surat Jalan from master PDF for portal uploads.

## 3. The Audit-First Architecture
The "Master Brain" (PortalReconciler) operates on a 3-step loop:

### Phase A: Ingest & Local Validation
- Run existing tools to generate `ContractData`.
- Cross-check Excel NIKs against OCR'd KTP bindings.
- **Rule:** 100% NIK/Nama match required for "Green" status.

### Phase B: Portal Reconciliation
- **Fetch:** Get portal state via `fetch_portal_contracts.py`.
- **Match:** Bind local `nomorKontrak` to portal `idkontrak`.
- **Audit:**
  - Check if `k_kontrak_nilai` matches local `totalPembayaran`.
  - Check if all Excel recipients exist in Portal RPB.
  - Check if BASTB/Proof images are uploaded.

### Phase C: Autonomous Sync (Expert Production)
- **Registration:** POST to `/master_penerima/store` if NIK missing.
- **RPB Linking:** POST to `/tambah_rincian` with structured JSON payloads.
- **Proof Upload:** POST to `/proses_upload_do_bukti` using multi-part form data for BASTB/Surat Jalan.

## 4. Data Consolidation Plan
- **`src/lib/contractStore.ts`:** Update to hold `portalMetadata` and `syncStatus`.
- **`tools/automation_service.py`:** Centralize all portal API interactions.
- **`REPOMIX_CONSOLIDATED.xml`:** Frequent updates to ensure AI context is always fresh.

## 5. Deployment & Session Handoff
- Every major logic change is committed with detailed "Why" in the commit message.
- `docs/internal/STATE.md` updated daily to track implementation progress.
- Link: https://github.com/MarsLogic/bastbanpem

---
**Approved by Strategy Map (sitemap-bastbanpem/explanation.html)**
