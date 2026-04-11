# Evidence Bundling — Specification

## Objective
Generate a consolidated PDF document for each recipient (or a master bundle for the contract) that serves as absolute administrative proof for audit.

## Success Criteria
- [ ] Ability to slice specific pages from the master contract PDF.
- [ ] Ability to embed local image files (KTP, Photos) into a PDF page.
- [ ] Layout must be professional, including headers with Contract No and Recipient Name.
- [ ] Export as a single ZIP file containing all individual recipient PDFs.

## Technical Components
- **Library**: `pdf-lib` (already in `package.json`) for PDF manipulation.
- **Service**: `src/lib/bundlerService.ts` to handle the heavy lifting.
- **UI**: "Export Audit Bundle" button in `ReconciliationTab.tsx`.

## Document Structure (per recipient)
1. **Page 1: Audit Cover**: Metadata, match score, and NIK verification.
2. **Page 2: Contract Evidence**: The sliced page from the "Titik Bagi" section.
3. **Page 3: Attachments**: KTP and Proof photos scaled to fit.
