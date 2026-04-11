# Reconciliation Reporting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the "Reconciliation" tab in the contract view that performs a cross-check between PDF delivery blocks and Excel rows.

---

## Tasks

### Task 1: Audit Logic Implementation
- [ ] Create `src/lib/auditEngine.ts`.
- [ ] Implement `performReconciliation(pdfBlocks, excelRows)` function.
- [ ] Use fuzzy name matching for recipient names (e.g., "KLP TANI MAJU" vs "POKTAN MAJU").
- [ ] Validate financial sums per block.

### Task 2: Reconciliation UI Component
- [ ] Create `src/components/ReconciliationTab.tsx`.
- [ ] Implement the Dual-Pane view (PDF Evidence on left, Audit results on right).
- [ ] Add "Export Audit Report" button.

### Task 3: Integration
- [ ] Add the Reconciliation tab to `src/components/ContractDetailView.tsx`.
- [ ] Connect audit results to the `onUpdate` contract store.

### Task 4: Verification
- [ ] Create Vitest unit tests for the audit engine.
- [ ] Manual test with a sample PDF and Excel pair.
