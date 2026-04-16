# Template: Bug Fix

Use this when diagnosing and fixing issues.

```markdown
# Task: Fix [Bug Name]

## Bug Description
**Issue:** [What's broken]
**Impact:** [Where it breaks]
**Frequency:** [Always / Sometimes / Under X condition]

## Suspected Modules (Logical IDs)
- [MODULE-###] — Primary suspect
- [MODULE-###] — Possible related issue

## Files to Read (Specific Ranges!)
```
[Affected file]
- Lines [where error happens]: The code causing issue
- Lines [where it's called]: How it's invoked
```

## How to Reproduce
```
[Exact steps to see bug]
```

## Root Cause Analysis
[What you think is wrong - helps AI search smarter]

## Related Commits
```bash
rtk git log --grep="[keyword]" -n 5
```

## Fix Strategy
[ ] Check git history for recent changes
[ ] Verify assumptions with ripgrep search
[ ] Test fix doesn't break related modules
[ ] Add test case if applicable

## Success Criteria
1. Bug no longer reproduces at [reproduction steps]
2. Doesn't break related functionality in [UIUX-###]
3. Performance unchanged (if applicable)
4. Git history is clean

## Dependency Check
```bash
rtk rg "function_name"  # Check all references
rtk rg "\[MODULE-###\]"  # Check all usages
```
```
