# Lessons Learned & Insights

This document captures what works and what doesn't. AI uses this to make better decisions and avoid past mistakes.

## Format

```markdown
### Lesson: [Title]
**Category:** Performance / Bug Prevention / Architecture / Token Efficiency  
**Context:** [When we learned this]  
**Insight:** [What did we discover?]  
**Action:** [What changed as a result?]  
**Date:** YYYY-MM-DD
```

---

## Performance Insights

### Lesson: Holistic PDF Sectioning via Sequential Anchors
**Category:** Performance / Architecture
**Context:** Needed to extract huge sections (50k+ chars like SSUK) and disparate tables from INAPROC PDFs.
**Insight:** Instead of complex regex for every field, first split the whole `full_text` into large chunks using "Section Anchors" (HEADER, PEMESAN, SSUK, etc.). This makes specialist extraction (like table finding) much more reliable as you only scan the relevant chunk.
**Action:** Updated [DOCS-003] to use `extract_sections` first, then specialized parsers on those sections. Persisted result to [DATA-003] metadata column.
**Date:** 2026-04-16

### Lesson: Polars Lazy Evaluation is a Game-Changer
**Category:** Performance  
**Context:** First Excel import with 50k rows was slow (5+ seconds)  
**Insight:** We were using `.collect()` immediately. Changed to lazy loading → 1 second.  
**Action:** All [DATA-001] operations now use `.scan_csv()` then lazy filters before `.collect()`  
**Date:** 2026-04-15

### Lesson: Batch OCR Processing Faster Than Single Pages
**Category:** Performance  
**Context:** Processing 100 documents individually took 30 minutes  
**Insight:** RapidOCR is faster when fed 10-50 pages at once (batching reduces overhead)  
**Action:** [DOCS-002] now batches OCR requests, down to 5 minutes  
**Date:** 2026-04-15

---

## Bug Prevention Insights

### Lesson: Always Check Logical ID Ripples Before Changes
**Category:** Bug Prevention  
**Context:** Changed [DATA-003] vault_service query, broke [UIUX-002] grid filtering  
**Insight:** Modified query returned different column order. UI expected specific order.  
**Action:** Created ripple check rule: `rtk rg "\[MODULE-ID\]"` before changing APIs  
**Date:** 2026-04-15

### Lesson: Context Managers Prevent File Descriptor Leaks
**Category:** Bug Prevention  
**Context:** After processing 1000 PDFs, ran out of file descriptors (OS limit ~1024)  
**Insight:** Files weren't being closed. One forgotten `.close()` multiplied by 1000 requests  
**Action:** All file operations now use `with` statements. [DOCS-001] audited for leaks.  
**Date:** 2026-04-15

---

## Architecture Insights

### Lesson: API Bridge ([UIUX-001]) Prevents Chaos
**Category:** Architecture  
**Context:** Early version had React calling FastAPI directly  
**Insight:** 
- Endpoints changed, frontend broke
- Error handling was inconsistent
- No centralized auth/logging

**Action:** Created [UIUX-001] as single source of truth. All calls go through there.  
**Date:** 2026-04-15

### Lesson: Three-Layer Pattern for Blob Persistence Across Page Reloads
**Category:** Architecture / Bug Prevention
**Context:** PDFs disappeared from viewer after page reload (same contract metadata persisted)
**Insight:** 
- Zustand's persist middleware uses JSON serialization by default
- JSON cannot serialize Blob objects (converts to `{}`)
- IndexedDB stores Blobs natively (no serialization needed)

**Action:** Implemented three-layer pattern:
1. Zustand store strips pdfBlob before saving (custom storage adapter)
2. IndexedDB stores Blobs separately (`pdfStorage.ts`)
3. Component hydrates from IndexedDB on mount (graceful fallback if missing)

Result: PDFs persist across page reloads, browser restarts, new tabs. ✅

See: `pdf_blob_persistence_pattern.md` memory file + commit 140f46ac

**Date:** 2026-04-16

---

## Token Efficiency Insights

### Lesson: Task Templates Save 40-60% Tokens Per Session
**Category:** Token Efficiency  
**Context:** AI was reading entire LOGICAL_MAP.md + many files it didn't need  
**Insight:** Only 3-5 files matter per task. The rest was wasted context.  
**Action:** Created `.claude/task-templates/` system. Now AI loads only what's needed.  
**Date:** 2026-04-16

### Lesson: Ripgrep Saves Time and Tokens
**Category:** Token Efficiency  
**Context:** `grep` for Logical IDs took 30 seconds. AI had to wait or search manually.  
**Insight:** Ripgrep is 100x faster. AI can search + read in seconds.  
**Action:** Updated CLAUDE.md to mandate `rtk rg` for all searches.  
**Date:** 2026-04-16

---

### Lesson: INAPROC Address Strings Need Fuzzy Normalisation, Not Just Regex
**Category:** Bug Prevention / Architecture  
**Context:** PDF extraction produced address strings with broken province names, hyphenated kabupaten, old province names (Nanggroe Aceh Darussalam). Regex-only cleaning didn't catch real-world variants.  
**Insight:** A static lookup table only covers what you've seen before. Fuzzy matching against an authoritative reference covers unseen variants automatically. Narrowing candidates by province → kabupaten → kecamatan hierarchy gives high accuracy even at 70% score threshold.  
**Action:** Built [DOCS-004] address_parser.py with `rapidfuzz.WRatio` + `backend/data/wilayah_reference.json` (38 prov, 514 kab, 7285 kec from Kemendagri). Use `address_parser.parse(raw)` for any INAPROC address.  
**Date:** 2026-04-16

---

## Decision Reversals

*If you discover a decision was wrong, document why here*

---

## Things to Avoid

- ❌ Reading entire files without specifying line ranges
- ❌ Using `grep` instead of `rg`
- ❌ Blocking I/O in FastAPI endpoints
- ❌ Eager loading of large CSV/Excel files
- ❌ Not checking Logical ID ripples before changes
- ❌ Hardcoding config values
- ❌ Forgetting context managers for file handles
- ❌ Generic exception handling (use custom exceptions)

---

## Best Practices That Emerged

- ✅ Always use task templates for context
- ✅ Ripgrep + rtk for searching
- ✅ Logical ID ripple check before changes
- ✅ Polars lazy evaluation for large files
- ✅ Async/await for all I/O
- ✅ Config-driven design (config.py)
- ✅ API bridge ([UIUX-001]) for frontend/backend
- ✅ Memory management (gc.collect() after large ops)
- ✅ **Always push to GitHub after tests pass** (prevents lost work)
- ✅ Test before closing session (catch bugs early)

### Lesson: Push to GitHub After Each Working Session
**Category:** Workflow / Risk Management  
**Context:** Developed feature locally, lost work when system crashed  
**Insight:** GitHub is backup + collaboration tool. Don't wait to push.  
**Action:** Every session now: test → review → **push to GitHub** (with user approval)  
**Date:** 2026-04-16

---

## How Future AI Uses This

Every session should:
1. **Skim this file** when starting (5 min)
2. **Reference relevant lessons** before implementing
3. **Add new lessons** when you discover something
4. **Update "Best Practices"** if you find better patterns

This is how **AI gets smarter over time** — not by re-learning the hard way, but by reading what you've already learned.
