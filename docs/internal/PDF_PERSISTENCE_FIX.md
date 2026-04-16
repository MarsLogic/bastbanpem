# [UIUX-005] PDF Persistence Fix: Cross-Page Reload Recovery

## Problem
When a user uploads a PDF contract and then refreshes the browser or opens a new tab:
- ✅ Contract metadata persists (name, fields, extracted data)
- ❌ PDF file disappears from the viewer

**Root Cause:** Blob objects cannot be serialized to JSON. When Zustand's persist middleware saves the contract state to localStorage via localforage, it converts the Blob to `{}`, losing the PDF reference.

## Solution Architecture

### Layer 1: Contract Store Cleanup
**File:** `src/lib/contractStore.ts`
- Added `createBlobSafeStorage()` custom storage adapter
- Strips all `pdfBlob` fields before persistence (they go to `null`)
- Prevents JSON serialization errors
- Stores only metadata in localforage

### Layer 2: PDF IndexedDB Storage
**File:** `src/lib/pdfStorage.ts` (NEW)
- Uses IndexedDB (which natively supports Blobs) instead of JSON
- Four operations:
  - `savePdfBlob(contractId, blob, path)` — Stores PDF in IndexedDB
  - `getPdfBlob(contractId)` — Retrieves PDF from IndexedDB
  - `deletePdfBlob(contractId)` — Removes PDF from IndexedDB
  - `clearAllPdfs()` — Nuclear option to clear all stored PDFs

### Layer 3: Hydration in PdfSyncModule
**File:** `src/components/PdfSyncModule.tsx`

**On component mount (useEffect):**
1. Try 1: Check if PDF is in memory (same-session) → Use immediately
2. Try 2: If missing, query IndexedDB → Restore and create object URL
3. Try 3: If both missing, show user a toast notification

**On PDF upload (handlePdfFileSelect):**
1. Create object URL for display
2. Save Blob to IndexedDB asynchronously
3. Update contract state
4. Show confirmation toast

## Data Flow

```
User Uploads PDF
  ↓
PdfSyncModule.handlePdfFileSelect()
  ├─ Create object URL → Display PDF
  ├─ Update contract state with pdfBlob
  └─ savePdfBlob(contractId, file) → IndexedDB
  
User Refreshes Browser
  ↓
PdfSyncModule mounts
  ├─ Check contract.pdfBlob (null after deserialization)
  └─ getPdfBlob(contractId) → Retrieve from IndexedDB
      ├─ Found? → Create object URL → Display PDF ✓
      └─ Not found? → Show re-upload prompt
```

## Browser Compatibility
- IndexedDB: [90%+ browser support](https://caniuse.com/indexeddb)
- Fallback: User can re-upload PDF (graceful degradation)

## Performance Notes
- PDF is stored once per contract (not per revision)
- IndexedDB operations are async (non-blocking)
- No impact on app startup (lazy loading)
- Memory usage: ~File size per stored contract

## Testing Checklist
- [ ] Upload PDF → Refresh page → PDF loads ✓
- [ ] Upload PDF → Close tab → Open new tab → PDF loads ✓
- [ ] Browser dev tools → Application → IndexedDB → BASTAutomator_PDFs → See stored Blob
- [ ] Delete contract → PDF is automatically removed from IndexedDB
- [ ] Large PDF (50MB+) → Verify IndexedDB limit handling

## Known Limitations
1. **Browser storage limits:** Most browsers allow ~50MB IndexedDB per origin
2. **Private browsing:** IndexedDB may not persist in some browsers' private modes
3. **Cross-domain access:** PDFs stored in one domain can't be accessed from another

## Future Improvements
- Compress PDFs before storing (gzip)
- Implement cleanup job for orphaned PDFs (deleted contracts)
- Add storage quota monitoring UI
- Export/import IndexedDB for backup

---
**Related:** [STATE-001] Enhanced PDF Extraction & Persistence
**Commit:** [UIUX-005] Implement IndexedDB PDF persistence for page reload recovery
