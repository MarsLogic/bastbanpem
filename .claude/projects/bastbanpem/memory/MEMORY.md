# BASTBANPEM Project Memory

## Intelligence Repair Patterns (April 2026)

### 1. The Truncated Mobile Prefix Pattern
**Problem**: OCR or legacy backend systems often truncate Indonesian mobile numbers to exactly 10 digits, stripping the leading `8` (e.g., `0853...` becomes `53...`).
**Solution**: A "Deep Healing" formatter in the frontend that identifies truncated mobile starts (`1`, `2`, `3`, `5`, `7`, `9`) and restores the `8`. This ensures all major Indonesian carriers (Telkomsel, Indosat, XL, Three) are restored to the `08...` standard.
**File**: `src/lib/dataCleaner.ts` -> `formatPhone`

### 2. The Reactive Triangulation Pulse
**Problem**: The UI can lock in "stale" empty results if the Master Data (83k records) finishes loading after the initial triangulation has run.
**Solution**: Linked the `isLoaded` state from the `useMasterDataStore` directly to the `useMemo` hooks in renderers. Added a "Analyzing Locations..." pulse to indicate background intelligence is still hydrating.
**File**: `FinancialSummaryRenderer.tsx`

### 3. High Confidence Regional Bridge
**Problem**: Fragmented location data (missing Kecamatan) causes holes in the final payment summary.
**Solution**: Implemented a logic where if the **Kabupaten** and **Desa** matches succeed with high confidence (threshold > 0.6), the system "bridges" the gap and force-populates the correct **Kecamatan** tier.
**File**: `src/lib/masterDataStore.ts` -> `resolveHierarchy`

---
*Last Updated: 2026-04-18*
