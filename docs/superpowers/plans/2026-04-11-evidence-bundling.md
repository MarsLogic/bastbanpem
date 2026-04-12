# Evidence Bundling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `bundlerService.ts` and connect it to the UI to generate the Audit Bundle ZIP.

---

## Tasks

### Task 1: Bundler Core Service
- [x] Create `src/lib/bundlerService.ts`.
- [x] Implement `generateRecipientBundle(contract, recipient, pdfBytes)`:
    - [x] Create cover page with `pdf-lib`.
    - [x] Extract/Slice evidence page from master PDF.
    - [x] Embed KTP and Photo images from local paths.
- [x] Implement `generateContractZip(contract)` using `jszip`.

### Task 2: UI Enhancements
- [x] Add "Generate Audit Bundle" button to `ReconciliationTab.tsx`.
- [x] Show progress indicator (e.g., "Bundling 12/45 recipients...").
- [x] Add "Download Audit ZIP" once complete.

### Task 3: File System Integration (Tauri)
- [x] Ensure Rust-side has permissions to read KTP/Photo folders for bundling.
- [x] Implement file save dialog for the final ZIP.

### Task 4: Verification
- [ ] Add unit test for PDF slicing in `bundlerService.test.ts`.
- [ ] Manual test bundling a recipient with all attachments.
