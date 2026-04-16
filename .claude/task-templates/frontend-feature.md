# Template: Frontend Feature

Use this when building React components or UI features.

```markdown
# Task: [Feature Name]

## Context
**Component:** [ExcelWorkbench / DocumentManager / ImageTaggerWorkspace / etc]
**What:** [Brief description]
**Why:** [Why this feature matters]

## Relevant Modules (Logical IDs)
- [UIUX-###] — React component being modified
- [UIUX-001] — API bridge (api.ts) - always check
- [CORE-###] — Backend endpoint involved (if new)

## Files to Read (Specific Ranges!)
```
src/components/[ComponentName].tsx
- Lines 1-50: Imports, type definitions
- Lines [specific]: Component structure you're modifying

src/lib/api.ts
- Lines [specific]: API function needed
```

## UI Patterns to Follow
- **Grid interactions:** See ExcelWorkbench.tsx for pattern
- **Form validation:** See [specific component]
- **State management:** Using React hooks, reference [example]
- **Styling:** Tailwind classes, consistent with existing tabs

## What Changed Last Session
[Reference to UI changes/decisions]

## Success Criteria
1. Component works with 1000+ rows (test performance)
2. Mobile responsive (test at 375px width)
3. Matches existing UI patterns in [UIUX-###]
4. API calls use [UIUX-001] bridge
5. Error handling follows [existing pattern]

## Dependency Check
```bash
rtk rg "export \[ComponentName\]"  # Check if exists
rtk rg "\[UIUX-001\]"  # Check API patterns
```
```
