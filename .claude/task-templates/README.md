# Task Templates: Context-Focused Development

When starting a new feature or fix, use these templates to load ONLY the relevant code context.

**Why?** AI reads only what matters for this specific task, saves tokens, stays focused.

## How to Use

1. Choose a template below based on your task type
2. Copy it to a new task file: `.claude/current-task.md`
3. Fill in the blanks (Logical IDs, files, context)
4. Every AI session reads this file first
5. AI knows exactly what to load, skips the rest

## Templates

- **backend-feature.md** — Adding/modifying backend functionality
- **frontend-feature.md** — UI changes, React components
- **bugfix.md** — Fixing issues in existing code
- **database.md** — Schema/data pipeline changes
- **integration.md** — Connecting multiple modules

---

## Example Workflow

```markdown
# Current Task (from .claude/current-task.md)

**Feature:** Add search filter to Document Manager

**Logical IDs:**
- [UIUX-003] — DocumentManager.tsx (what we're changing)
- [UIUX-001] — api.ts (API calls needed)
- [DATA-002] — location_service.py (backend)

**Files to Read:**
- src/components/DocumentManager.tsx (lines 1-150)
- src/lib/api.ts (searchDocuments function)
- backend/services/location_service.py (lines 40-100)

**What AI Needs to Know:**
- Last session we refactored ExcelWorkbench grid
- Search should filter by document type + location
- Use Polars lazy loading for performance

**Success Criteria:**
- Search works on 1000+ documents in <500ms
- Matches existing UI patterns in other workbench tabs
```

**Result:** New AI session reads ONE file, knows exactly what to do, loads 3 specific code chunks. No wasted context.
