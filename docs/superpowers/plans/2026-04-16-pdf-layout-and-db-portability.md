# PDF Layout Stack + Database Portability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change PdfSyncModule layout from side-by-side to vertical stack (PDF on top, data panel below), fix the database to live inside `App_Data/` for true portable-app portability, and clarify how/when data is persisted to SQLite.

**Architecture:**
- Layout: Remove `md:w-1/2` half-width split; replace with `flex-col` stacking. PDF viewer gets fixed height `h-[500px]`, intelligence panel gets its own `h-[600px]` with internal scroll.
- DB path: Change `DB_PATH` in `backend/db.py` from a bare relative string to an absolute path derived from `config.settings.BASE_DIR`. Migrate existing `bastbanpem_vault.db` from project root to `App_Data/bastbanpem_vault.db`.
- Save-on-scan: Add auto-save call to `/contracts/save` immediately after a successful "Run AI Scan" so extracted data is durably stored in SQLite without needing a separate save step.

**Tech Stack:** React 19, Tailwind CSS, Python FastAPI, SQLite, Zustand/localforage

---

## Context: How Data Is Currently Persisted

| Layer | Storage | Portable? | Survives browser clear? |
|-------|---------|-----------|------------------------|
| PDF Blob | Browser `localforage` (IndexedDB) | ❌ Browser-tied | ❌ No |
| Contract fields (Zustand) | Browser `localforage` (IndexedDB) | ❌ Browser-tied | ❌ No |
| Contract metadata after `/contracts/save` | `bastbanpem_vault.db` (SQLite) | ✅ File moves with app | ✅ Yes |

**Key insight:** The `/pdf/parse` endpoint does NOT auto-save to SQLite. The frontend must explicitly call `/contracts/save` to persist to the database. This plan adds that auto-save after a successful scan.

---

## Files

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/PdfSyncModule.tsx` | Modify lines 168, 227, 230 | Change flex layout to vertical stack |
| `backend/db.py` | Modify line 6 | Move DB path into App_Data directory |
| `start.bat` | Modify | Add DB migration from root → App_Data on startup |

---

## Task 1: Fix Layout — Vertical Stack (PDF on Top)

**Files:**
- Modify: `src/components/PdfSyncModule.tsx:168` — PDF viewer wrapper class
- Modify: `src/components/PdfSyncModule.tsx:227` — outer container class
- Modify: `src/components/PdfSyncModule.tsx:230` — intelligence panel class

### Context: What lines do what

```
Line 168: renderPdfViewer wrapper — currently w-full md:w-1/2 (half-width, side-by-side)
Line 227: outer container — currently "flex" (default = row = side-by-side)
Line 230: intelligence panel — currently "w-full md:w-1/2" (half-width)
```

- [ ] **Step 1: Fix `renderPdfViewer` to full-width with fixed height**

In `src/components/PdfSyncModule.tsx`, find line 168:
```tsx
// BEFORE (line 168):
<div className={`flex flex-col relative bg-muted/30 ${isFull ? 'w-full h-full' : 'w-full md:w-1/2 border-r h-[400px] md:h-full'}`}>
```
Change to:
```tsx
// AFTER (line 168):
<div className={`flex flex-col relative bg-muted/30 ${isFull ? 'w-full h-full' : 'w-full border-b h-[500px]'}`}>
```
Key changes: `md:w-1/2` → removed (full width), `border-r` → `border-b` (separator goes under, not to the right), `h-[400px] md:h-full` → `h-[500px]` (fixed height for viewer).

- [ ] **Step 2: Fix outer container to `flex-col`**

Find line 227:
```tsx
// BEFORE (line 227):
<div className={`flex bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden ${isFullscreen ? 'fixed inset-4 z-[100] m-0' : 'h-[650px]'}`}>
```
Change to:
```tsx
// AFTER (line 227):
<div className={`flex flex-col bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden ${isFullscreen ? 'fixed inset-4 z-[100] m-0 flex-row' : ''}`}>
```
Key changes: added `flex-col` (vertical stack by default); removed `h-[650px]` (let it size naturally); fullscreen still uses `flex-row` for side-by-side.

- [ ] **Step 3: Fix intelligence panel to full-width with fixed scroll height**

Find line 230:
```tsx
// BEFORE (line 230):
<div className="w-full md:w-1/2 flex flex-col bg-slate-50/30 min-w-0">
```
Change to:
```tsx
// AFTER (line 230):
<div className="w-full flex flex-col bg-slate-50/30 min-w-0 h-[600px]">
```
Key changes: `md:w-1/2` → removed (full width), added `h-[600px]` so the panel has its own scroll container height.

- [ ] **Step 4: Verify layout in browser**

Start the app and open PDF Sync tab. Load the test PDF `surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf`.
Expected: PDF viewer renders at full width, ~500px tall. Below it, the Contract Intelligence panel appears at full width with tabs (Fields, Text, Tables, RPB). No horizontal split.

- [ ] **Step 5: Rebuild and verify no TypeScript errors**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/PdfSyncModule.tsx
git commit -m "feat: [UIUX-005] stack PDF viewer above intelligence panel (vertical layout)"
```

---

## Task 2: Fix Database Path for Portable App

**Files:**
- Modify: `backend/db.py:6` — change `DB_PATH` to use `App_Data/`

### Context: Current problem

```python
# backend/db.py line 6
DB_PATH = "bastbanpem_vault.db"   # relative to CWD = project root
```

When `start.bat` runs, CWD is the project root, so the DB is created at `C:\Users\Wyx\bastbanpem\bastbanpem_vault.db`. This works but is messy — the `App_Data/` directory is the designated data folder per `config.py` (line 12: `DATA_DIR: str = os.path.join(BASE_DIR, "App_Data")`). Portable apps should keep all user data in one folder so users can back it up or transfer it by copying just `App_Data/`.

- [ ] **Step 1: Update `DB_PATH` to use `App_Data/`**

In `backend/db.py`, replace lines 1–6:
```python
# BEFORE
import sqlite3
import os
import json
from contextlib import contextmanager

DB_PATH = "bastbanpem_vault.db"
```
With:
```python
# AFTER
import sqlite3
import os
import json
from contextlib import contextmanager

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_DIR = os.path.join(_BASE_DIR, "App_Data")
os.makedirs(_DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(_DATA_DIR, "bastbanpem_vault.db")
```
Why not import from `config.py`? Avoids circular imports — `db.py` is imported before settings are fully loaded. This mirrors what `config.py` already computes (same logic, independent).

- [ ] **Step 2: Migrate existing database if it exists in project root**

Add a migration helper at the bottom of `backend/db.py`, just before `db = Database()`:

```python
# Migrate legacy DB from project root to App_Data if needed
_legacy_path = os.path.join(_BASE_DIR, "bastbanpem_vault.db")
if os.path.exists(_legacy_path) and not os.path.exists(DB_PATH):
    import shutil
    shutil.move(_legacy_path, DB_PATH)
```

This runs once automatically on startup. If the old file exists and the new location doesn't, it moves it silently. After migration, start.bat launches cleanly with data intact.

- [ ] **Step 3: Start the backend and verify DB location**

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Then check:
```bash
ls -lah App_Data/bastbanpem_vault.db
ls bastbanpem_vault.db   # should be gone after migration
```
Expected: `App_Data/bastbanpem_vault.db` exists (~28KB or more). Root `bastbanpem_vault.db` no longer present.

- [ ] **Step 4: Commit**

```bash
git add backend/db.py
git commit -m "fix: [CORE-001] move SQLite DB into App_Data/ for portable app support"
```

---

## Task 3: Auto-Save Extracted Metadata to SQLite After AI Scan

**Files:**
- Modify: `src/components/PdfSyncModule.tsx` — `handleAutoExtract` function (~line 78)
- Modify: `src/lib/api.ts` — add `saveContract` function

### Context

Currently when "Run AI Scan" is clicked, metadata is extracted and stored **only in the browser Zustand store** (localforage/IndexedDB). If the user clears browser storage or uses a different browser, the data is gone. The backend endpoint `/contracts/save` exists and is ready — it just isn't called after a scan.

- [ ] **Step 1: Add `saveContract` API function**

In `src/lib/api.ts`, add after the `parsePdfFile` export:

```typescript
export const saveContract = async (
  id: string,
  name: string,
  targetValue: number,
  metadata: Record<string, any>
): Promise<void> => {
  await apiClient.post(
    `/contracts/save?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}&target_value=${targetValue}`,
    { rows: [], metadata }
  );
};
```

- [ ] **Step 2: Call `saveContract` after successful scan in `handleAutoExtract`**

In `PdfSyncModule.tsx`, find the end of the `try` block in `handleAutoExtract` (~line 151), just before `onUpdate(updates)`:

```tsx
// BEFORE (line ~151):
      onUpdate(updates);
      toast.success(`Elite AI Scan complete. Extracted data from ${result.total_pages} pages.`);
```

Change to:
```tsx
      onUpdate(updates);

      // Auto-persist extracted metadata to SQLite vault
      const contractId = (m.nomor_kontrak || 'UNKNOWN').replace(/\s+/g, '_');
      try {
        await saveContract(contractId, m.nomor_kontrak || 'Unknown Contract', 0, m);
        toast.success(`Elite AI Scan complete. Extracted from ${result.total_pages} pages. Saved to vault.`);
      } catch {
        toast.success(`Elite AI Scan complete. Extracted from ${result.total_pages} pages. (Vault save skipped)`);
      }
```

Also add `saveContract` to the import at the top of PdfSyncModule.tsx:
```tsx
import { parsePdfFile, saveContract } from '../lib/api';
```

- [ ] **Step 3: Verify end-to-end**

1. Run app in DEBUG mode
2. Open PDF Sync tab
3. Attach the test PDF
4. Click "Run AI Scan"
5. Check toast: should say "Saved to vault"
6. Query the DB to verify:
```bash
python -c "import sqlite3; c=sqlite3.connect('App_Data/bastbanpem_vault.db'); print(c.execute('SELECT id,name FROM contracts').fetchall())"
```
Expected: Row with the contract nomor appears.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/PdfSyncModule.tsx src/lib/api.ts
git commit -m "feat: [UIUX-005][DATA-003] auto-save extracted metadata to SQLite vault after AI scan"
```

---

## Self-Review Checklist

- [x] **Layout change** covered by Task 1 — all 3 affected lines addressed
- [x] **DB portability** covered by Task 2 — path absolute, migration included
- [x] **"Do we save on PDF load?"** answered in context table above — No, only on scan. Task 3 adds auto-save after scan.
- [x] **"How to load saved data in portable setup?"** — data in `App_Data/bastbanpem_vault.db` moves with the app folder. Future session: query vault and hydrate Zustand store from `/contracts/{id}` endpoint.
- [x] No placeholders in any task — all code is complete and exact.
- [x] Types consistent — `saveContract` matches `/contracts/save` query param signature in `router.py:281`.
