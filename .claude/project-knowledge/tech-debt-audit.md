# Tech Debt Audit: Non-Web Stack Code

**Date:** 2026-04-16  
**Finding:** App has Tauri (desktop framework) code that conflicts with React 19 + Vite + FastAPI tech stack

---

## Summary

| Item | Count | Status | Priority |
|------|-------|--------|----------|
| Tauri imports | 5 | Found | 🔴 High |
| Tauri functions used | 6 | Found | 🔴 High |
| Other desktop frameworks | 0 | ✓ Clear | ✅ None |
| Desktop-specific code patterns | 2 | Found | 🟡 Medium |

---

## Detailed Findings

### 1. ImageTaggerWorkspace.tsx [UIUX-004]

**Tauri dependencies:**
- `@tauri-apps/plugin-fs` → `readDir()`, `writeFile()`, `readFile()`
- `@tauri-apps/api/core` → `convertFileSrc()`

**What it's doing:**
- **Line 141:** `readDir(dirPath)` — Reading local directory of images
- **Line 151:** `convertFileSrc(fullPath)` — Converting file paths to URLs
- **Line 199:** `writeFile(newPath, bytes)` — Saving edited images to disk
- **Line 200:** Creates new image entry with Tauri-converted path

**Web app equivalent:**
- Use HTML `<input type="file" multiple>` to upload images
- Send to FastAPI backend for processing
- Store on server, retrieve via API
- No need for local filesystem access

**Impact:** Component is locked to desktop, can't run in browser

---

### 2. ReconciliationTab.tsx [UIUX-002]

**Tauri dependencies:**
- `@tauri-apps/plugin-dialog` → `save()`
- `@tauri-apps/plugin-fs` → `writeFile()`

**What it's doing:**
- **Line 105-108:** `save()` — Opens native "Save As" dialog
- **Line 113:** `writeFile(savePath, bytes)` — Writes ZIP file to chosen path

**Web app equivalent:**
- Use browser's native download mechanism: 
  ```javascript
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'filename.zip';
  a.click();
  ```

**Impact:** Requires Tauri dialog for file save operations

---

## Unused Dependencies

```json
{
  "@tauri-apps/plugin-dialog": "^2.7.0",  // Not in package.json
  "@tauri-apps/plugin-fs": "^?.?.?",      // Not in package.json
  "@tauri-apps/api": "^?.?.?"             // Not in package.json
}
```

**Status:** Installed but marked "extraneous" (not declared in package.json)

---

## Remediation Tasks

### Priority 1 (High) — Remove File System Operations

**ImageTaggerWorkspace refactor:**
1. Replace `readDir()` with HTML file upload
2. Remove `convertFileSrc()` — use proper URLs from backend
3. Send files to FastAPI endpoint for processing
4. Update component to work with backend API

**ReconciliationTab refactor:**
1. Replace Tauri `save()` with browser download API
2. Remove `writeFile()` — let browser handle download
3. FastAPI should provide the ZIP file via HTTP response

### Priority 2 (Medium) — Clean Dependencies

1. Remove Tauri packages entirely from node_modules
2. Verify no build errors
3. Document in CLAUDE.md: "Pure web stack, no desktop framework"

### Priority 3 (Low) — Architecture Notes

Update CLAUDE.md section 4 to clarify:
- File uploads: HTML input → FastAPI
- File downloads: Browser download API ← FastAPI
- No local filesystem access from frontend

---

## Tech Stack Clarification

**Current (Conflicted):**
- Frontend: React 19 + Vite ✅
- Backend: FastAPI ✅
- Desktop Framework: Tauri ❌ (not needed)

**Target (Pure Web):**
- Frontend: React 19 + Vite ✅
- Backend: FastAPI ✅
- File handling: HTTP APIs ✅
- No desktop framework ✅

---

## Files to Update (When Ready)

- `src/components/ImageTaggerWorkspace.tsx` — Remove Tauri, use file input
- `src/components/ReconciliationTab.tsx` — Remove Tauri, use browser download
- `CLAUDE.md` — Update tech stack documentation
- `package.json` — Remove Tauri references (already not declared)

---

## Questions for User

1. Should we refactor ImageTaggerWorkspace and ReconciliationTab immediately?
2. Or schedule as separate tasks?
3. How should image directory/file handling work without Tauri?
   - Upload via file input?
   - Scan directory on backend?
   - Store on server?
