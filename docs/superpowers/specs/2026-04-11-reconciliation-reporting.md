# Reconciliation Reporting — Specification

## Objective
Provide a detailed, per-contract audit report that proves the PDF (Surat Pesanan) matches the Excel (Distribution Matrix) with 100% accuracy. This is required for administrative compliance.

## Success Criteria
- [ ] Automated comparison of every delivery block in the PDF against the corresponding Excel rows.
- [ ] Highlight discrepancies in quantity, recipient names, and financial totals.
- [ ] Generate a downloadable "Audit Evidence" PDF containing the report and the sliced PDF pages.
- [ ] "Magic Balance" flag: Indicate when rounding corrections were applied to match the total.

## Data Schema
### Audit Discrepancy
```typescript
interface AuditIssue {
  type: 'QUANTITY_MISMATCH' | 'NAME_FUZZY_MATCH' | 'MISSING_DATA' | 'ROUNDING_ERROR';
  severity: 'high' | 'medium' | 'low';
  message: string;
  pdfValue: string;
  excelValue: string;
  pageSource: number;
}
```

## UI Pattern: Dual-Pane Reconciliation
- **Left Pane**: The original PDF section (Titik Bagi).
- **Right Pane**: The Excel reconciliation table with "status" indicators (✅, ⚠️, ❌).
