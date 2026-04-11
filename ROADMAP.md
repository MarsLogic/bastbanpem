# BAST-Automator Master Roadmap

This document is the **Source of Truth** for all AI agents (Claude, Gemini, etc.) working on this repository. It ensures continuity across sessions and prevents task duplication.

## 🏁 Current Milestone: Milestone 4 — Evidence Bundling
**Status**: 5% Complete
**Goal**: Automate the generation of administrative "Audit Proofs".

### Completed Tasks (Verified)
- [x] **T1: PDF Research**: `pdf_pattern_learner.py` achieved 100% accuracy on metadata.
- [x] **T2: Parser Port**: Regex and section-anchors ported to `src/lib/pdfContractParser.ts`.
- [x] **T3: Audit Engine**: `src/lib/auditEngine.ts` implemented with fuzzy matching and scoring.
- [x] **T4: Dual-Pane UI**: "Audit & Reconciliation" tab integrated into `ContractDetailView.tsx`.
- [x] **T5: Math Precision**: `decimal.js` and `applyMagicBalance` solve rounding errors.
- [x] **T6: Global Deduplication**: Cross-contract NIK indexing and UI flagging implemented.

---

## 🚀 Active Roadmap (Remaining Tasks)

### 🔴 Milestone 3: Global Integrity (Deduplication)
- **Objective**: Prevent NIKs from receiving duplicate aid across different contracts.
- **Task 3.1: Global NIK Registry**: Implement a Zustand or LocalForage-backed store that indexes all NIKs across all loaded contracts.
- **Task 3.2: Duplicate UI**: Show a "Warning" badge in `ExcelWorkbench` if a NIK is already present in another contract.
- **Plan**: `docs/superpowers/plans/2026-04-11-global-deduplication.md` (To be created).

### 🔴 Milestone 4: Evidence Bundling
- **Objective**: Automate the generation of administrative "Audit Proofs".
- **Task 4.1: Audit Bundle Generator**: A script/service that merges the Audit Report + Sliced PDF pages + KTP/Photos into a single `[Contract]_Audit_Bundle.pdf`.
- **Task 4.2: Zip Export**: Export a folder structure optimized for manual portal upload.

### 🔴 Milestone 5: Portal Injection (Native Automation)
- **Objective**: The "Inject to Portal" button functionality.
- **Task 5.1: Headless Portal Driver**: Tauri-side command to drive a browser (or fetch API) to push data.
- **Task 5.2: Verification Gate**: Enforce `score === 100` and `syncGaps === 0` before allowing injection.

---

## 🏗️ Technical Standards (Agent Mandates)
1. **Never use standard Float**: Use `Decimal` from `decimal.js`.
2. **Persistence**: Use `localforage` for data that must survive app restarts.
3. **Planning**: Use `docs/superpowers/` for any new Spec/Plan.
4. **Validation**: Every new `src/lib` logic file MUST have a corresponding `.test.ts` in `src/lib/__tests__/`.
5. **Token Efficiency**: Prefix all shell commands with `rtk`.

---

## 📂 Data Structure Mapping
- `src/lib/contractStore.ts`: The central repository of all contract data.
- `src/lib/pdfContractParser.ts`: The section-aware PDF text engine.
- `src/lib/auditEngine.ts`: The reconciliation logic.
- `output/parsed_contracts.json`: The "Gold Standard" research results.
