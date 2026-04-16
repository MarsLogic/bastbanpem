# Template: Backend Feature

Use this when adding/modifying backend functionality.

```markdown
# Task: [Feature Name]

## Context
**What:** [Brief description of what you're building]
**Why:** [Why this matters]
**Related Feature:** [If continuing from previous work]

## Relevant Modules (Logical IDs)
- [CORE-###] — Core infrastructure involved
- [DATA-###] — Data layers needed
- [DOCS-###] — Document processing if applicable

## Files to Read (Specific Ranges!)
```
backend/services/[module_name].py
- Lines 1-50: Imports and class definition
- Lines [specific]: Function you're modifying
```

## What Changed Last Session
[Reference to recent commits/decisions]

## Tech Stack Constraints
- **Memory:** Use Polars (Lazy), explicit gc.collect()
- **Async:** FastAPI, no blocking I/O
- **Config:** Read from backend/config.py
- **Exceptions:** Use backend/exceptions.py custom framework

## Success Criteria
1. [Testable requirement 1]
2. [Testable requirement 2]
3. Follows [DATA-###] patterns from vault_service
4. No breaking changes to [UIUX-001] endpoints

## Dependency Check
Run this before starting:
```bash
rtk rg "\[CORE-007\]"  # Check what depends on this module
rtk rg "def your_function"  # Check if already exists
```
```
