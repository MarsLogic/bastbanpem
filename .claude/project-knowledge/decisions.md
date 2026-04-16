# Architectural Decisions Log

When AI makes a design decision, it goes here. Future AI sessions read this to understand WHY the code is structured this way.

## Format

Each decision:
```markdown
### Decision: [Title]
**Date:** YYYY-MM-DD  
**Context:** [What problem were we solving?]  
**Decision:** [What did we choose?]  
**Rationale:** [Why?]  
**Alternatives Considered:** [What else could we have done?]  
**Impact:** [What changed?]  
**Status:** Active / Superseded
```

---

## Example Decisions (Update These as You Build)

### Decision: Use Polars Instead of Pandas
**Date:** 2026-04-15  
**Context:** Needed to handle large Excel files (100k+ rows) without exceeding 4GB RAM  
**Decision:** Use Polars with lazy evaluation  
**Rationale:** 
- Polars is 10-100x faster than Pandas
- Lazy evaluation means data isn't loaded until needed
- Better memory efficiency aligns with 4GB target

**Alternatives Considered:**
- Pandas (too slow, eager loading)
- DuckDB (more complex for Excel)
- Spark (overkill, requires cluster)

**Impact:** 
- All Excel processing uses Polars
- Data pipeline in [DATA-001] is non-blocking
- Memory usage stayed within constraints

**Status:** Active

---

### Decision: AsyncIO for All I/O Operations
**Date:** 2026-04-15  
**Context:** FastAPI events can't block. Need to process files, queries, PDFs without stalling other requests  
**Decision:** All I/O operations are async  
**Rationale:**
- FastAPI runs on async event loop
- Blocking I/O would freeze all other requests
- Async allows 10+ concurrent document processes

**Alternatives Considered:**
- Threading (Python GIL limitations)
- Synchronous endpoints (blocks other users)
- Celery workers (adds complexity, overkill initially)

**Impact:**
- All services ([DATA-###], [DOCS-###]) are async
- Can process multiple documents in parallel
- Better utilization of hardware_orchestrator resources

**Status:** Active

---

### Decision: Logical ID System for Code Reference
**Date:** 2026-04-15  
**Context:** Large codebase, hard for AI to know what changed and what depends on it  
**Decision:** Every module gets a Logical ID ([CORE-001], [DATA-002], etc)  
**Rationale:**
- AI can reference code without reading it ("check [DATA-001]")
- Dependency tracking easier (ripple check: what breaks if I change [DATA-001]?)
- Future sessions know module purpose instantly

**Alternatives Considered:**
- Inline comments (scattered, hard to reference)
- File names only (loses context, no dependencies)
- No system (AI re-reads everything, wastes tokens)

**Impact:**
- LOGICAL_MAP.md created
- All code changes reference Logical IDs
- Ripple checks prevent bugs
- AI can work with surgical precision

**Status:** Active

---

### Decision: Task Templates for Context Management
**Date:** 2026-04-16  
**Context:** AI sessions expire, lose context. But re-reading whole codebase wastes tokens.  
**Decision:** Create `.claude/task-templates/` with feature-specific context  
**Rationale:**
- New AI sessions load only `.claude/current-task.md`
- Task file specifies which files/modules to read
- Reduces context bloat from 50 files → 3 files

**Alternatives Considered:**
- Read entire LOGICAL_MAP.md (slow, lots of unneeded context)
- Re-read all backend code every session (tokens wasted)
- No structure (AI wastes time figuring out what matters)

**Impact:**
- Each session is surgical + focused
- AI doesn't re-read unrelated code
- Token usage drops 40-60% per session

**Status:** Active (newly implemented)

---

### Decision: Fuzzy Location Matching with Offline Reference Data
**Date:** 2026-04-16  
**Context:** INAPROC PDFs contain malformed address strings — province name typos, kabupaten hyphenation splits, old province names (Nanggroe Aceh Darussalam), abbreviated kecamatan (Sei vs Sungai). A hardcoded 30-entry table was insufficient.  
**Decision:** Download full Kemendagri administrative data once (38 prov, 514 kab, 7285 kec) into `backend/data/wilayah_reference.json` and use `rapidfuzz.WRatio` fuzzy matching at parse time.  
**Rationale:**
- Covers all edge cases without manual curation
- `rapidfuzz` already in requirements.txt
- Reference data loaded once via `@lru_cache` — zero repeated I/O cost
- Narrows kab candidates to matching province, kec candidates to matching kab → higher accuracy

**Alternatives Considered:**
- Hardcoded lookup table (only covered ~30 provinces, missed kab/kec variants)
- External API call at parse time (adds latency, offline risk)
- difflib.get_close_matches (slower, lower accuracy than rapidfuzz WRatio)

**Impact:**
- `backend/services/address_parser.py` — [DOCS-004] — now has `normalise_province`, `normalise_kabupaten`, `normalise_kecamatan` with fuzzy matching
- `backend/data/wilayah_reference.json` — 328 KB reference file (do not delete)
- Output canonical forms: `"Kabupaten X"` or `"Kota X"` for kabupaten; proper-cased province

**Status:** Active

---

## Decisions Under Review

*Add decisions you're unsure about here, revisit after a few sessions*

---

## Superseded Decisions

*When you change a decision, move it here with explanation*

---

## How to Use This File

When starting a feature:
1. **Read decisions related to your task** (e.g., "Architectural Decisions → Polars")
2. **Understand the rationale** (why are we doing this this way?)
3. **Follow established patterns** (don't invent new approaches)
4. **If you break a decision, record why** (update Status → Superseded)

Every decision here is **AI learning**. The more complete this is, the smarter future AI gets.
