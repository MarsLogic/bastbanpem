# Current Task (Active Development)

Edit this file when starting a new feature, bugfix, or task. Every new AI session will read this first.

**Example format below — replace with your actual task:**

---

## Task Template (Copy & Fill In)

```markdown
# Task: [Feature/Bugfix Name]

## Context
**What:** [Brief description]
**Why:** [Why this matters]
**Related to:** [Previous task or feature]

## Relevant Modules (Logical IDs)
- [CORE-###] — [reason]
- [DATA-###] — [reason]
- [UIUX-###] — [reason]

## Files to Read (Specific Ranges!)
- `backend/services/file.py` (lines 10-50)
- `src/components/Component.tsx` (lines 1-100)

## Context from Previous Sessions
- [What was done last session]
- [What decisions were made]
- [What to avoid]

## Success Criteria
1. [Testable requirement 1]
2. [Testable requirement 2]
3. [Quality metric 3]

## Commands to Run
```bash
# Before starting:
rtk rg "\[MODULE-ID\]"  # Find what depends on this

# After implementation:
npm test
pytest tests/
rtk git diff
```
```

---

## How to Use This File

1. **Before starting work:** Fill in the template above with your actual task
2. **Save the file:** `.claude/current-task.md`
3. **Start new AI session:** It automatically reads this
4. **After completing task:** Delete this file (or rename with date)

---

## Active Tasks (Current)

*None currently. Fill in your first task!*

---

## Completed Tasks (Archive)

*Move completed tasks here with their results*
