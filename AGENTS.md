# BAST-Automator: Agent & Antigravity AI Configuration

This file configures autonomous agents (including Antigravity AI) to maintain design consistency and code quality.

---

## Instruction Priority (CRITICAL)

1. **CLAUDE.md** — Core project rules (HIGHEST)
2. **This file (AGENTS.md)** — Agent-specific configuration
3. **Default system behavior** — Fallback only (LOWEST)

**NEVER OVERRIDE** CLAUDE.md rules. This file extends, not replaces.

---

## 1. Design System (MANDATORY)

Before ANY code generation or modification:

**Read**: `.claude/design-system.md`

This is the **single source of truth** for:
- ✓ Colors (palette of 6 colors)
- ✓ Typography (Geist Sans/Mono)
- ✓ Icons (Lucide React)
- ✓ Component patterns
- ✓ Spacing & layout
- ✓ Toast styling
- ✓ Button patterns
- ✓ Table styling

**Non-negotiable**: Every component must comply.

---

## 2. Agent Capabilities & Constraints

### What This Agent CAN Do
- ✅ Create new React components following design system
- ✅ Edit existing components (colors, icons, styling)
- ✅ Generate toast notifications with semantic colors
- ✅ Create tables, buttons, badges following patterns
- ✅ Generate TypeScript with full type safety
- ✅ Run builds and verify compilation
- ✅ Create pull requests after user approval
- ✅ Execute git commits (with user confirmation)

### What This Agent CANNOT Do
- ❌ Use colors outside the palette (no random hex codes)
- ❌ Use icons not from lucide-react
- ❌ Override design system patterns
- ❌ Create hardcoded styles (must use design system)
- ❌ Skip testing before deployment
- ❌ Skip pushing `.md` changes immediately

**MANDATORY**: Any change to `.md` files MUST be pushed immediately to https://github.com/MarsLogic/bastbanpem.

---

## 3. Pre-Generation Checklist

Before generating ANY component:

```
□ Read .claude/design-system.md (colors, icons, patterns)
□ Understand component requirements (from user)
□ Verify design system compliance (checklist in design-system.md)
□ Plan component structure
□ Identify colors/icons needed
□ Check for similar patterns in codebase
```

---

## 4. Code Generation Template

### React Component
```typescript
import { FileUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// ✅ Use colors from design system
// ✅ Use icons from lucide-react
// ✅ Use Tailwind classes (gap, p, rounded, etc.)
// ✅ Include hover/disabled states
// ✅ Add semantic type safety

const MyComponent: React.FC<Props> = ({ data }) => {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
      <FileUp className="h-5 w-5 text-slate-600" />
      <span className="text-[11px] font-black text-slate-700">Action</span>
    </div>
  );
};

export { MyComponent };
```

### Toast Notification
```typescript
// Success (Dark Grey)
toast.success('Scan complete', {
  style: {
    backgroundColor: '#374151',
    color: '#ffffff',
    border: '1px solid #1f2937',
  },
});

// Error (Very Dark Grey)
toast.error('Upload failed', {
  style: {
    backgroundColor: '#1f2937',
    color: '#ffffff',
    border: '1px solid #111827',
  },
});
```

### Button
```typescript
<Button className="bg-slate-900 hover:bg-black text-white px-8 rounded-full transition-all">
  <Zap className="mr-2 h-5 w-5" /> PDF SCAN
</Button>
```

### Table Row
```typescript
<tr className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors">
  <td className="px-3 py-2.5 text-[10px] font-black text-slate-700">Data</td>
</tr>
```

---

## 5. Design Compliance Rules (Enforceable)

### Colors
```
✅ Use: #ffffff, #f3f4f6, #6b7280, #374151, #1f2937, #111827
❌ Use: #123456, #abcdef, rgb(10,20,30), random hex
```

### Icons
```
✅ import { FileUp, Zap, AlertCircle } from 'lucide-react'
❌ import { SomeIcon } from 'other-library'
```

### Typography
```
✅ className="font-sans text-[10px] font-black"
✅ className="font-mono text-[11px]"
❌ style={{ fontSize: '14px', fontFamily: 'Arial' }}
```

### Spacing
```
✅ gap-2, p-4, rounded-lg, border-slate-200
❌ margin: 10px, padding: 5px, custom spacing values
```

### States
```
✅ hover:bg-slate-50, disabled:opacity-30, transition-colors
❌ No hover states, no disabled styling
```

---

## 6. Pre-Deployment Verification

### Build Check
```bash
npm run build
# Must complete with no errors
# Warnings acceptable if they're pre-existing
```

### Type Check
```bash
npx tsc --noEmit
# Must pass with zero errors
```

### Visual Inspection
```
□ Colors match design system palette
□ Icons visible and correct size
□ Spacing consistent (gap, padding)
□ Hover states work
□ Disabled states styled
□ Toast notifications have semantic colors
```

### Git Check
```bash
git diff --cached
# Review all changes match design system
# Verify no hardcoded colors outside palette
```

---

## 7. Agent Workflow (Step-by-Step)

### 1. Receive Task
```
User: "Add a new PDF upload button to the dashboard"
```

### 2. Load Design System
```
Read .claude/design-system.md
→ Understand button patterns
→ Identify required colors/icons
→ Note spacing rules
```

### 3. Plan Component
```
□ Button type: Primary (dark background)
□ Icon: FileUp (from lucide-react)
□ Colors: bg-slate-900, hover:bg-black, text-white
□ Sizing: px-8, h-8, rounded-full
□ State: Hover, disabled, loading
```

### 4. Generate Component
```
Create component following template
Apply design system colors/icons/spacing
Include TypeScript types
Add all states (hover, disabled)
```

### 5. Verify Compliance
```
Run checklist from design-system.md
✓ Colors from palette
✓ Icons from lucide-react
✓ Spacing from Tailwind
✓ States included
✓ No hardcoded values
```

### 6. Build & Test
```bash
npm run build    # Must pass
npm test         # Must pass
npx tsc --noEmit # Must pass
```

### 7. Commit (with User Approval)
```bash
git diff          # Show user
git add .         # After approval
git commit -m "feat: [UIUX-###] Add PDF upload button"
```

### 8. Request Review
```
"Component ready. Please review git diff and approve:
- Design system compliance ✓
- All colors/icons/spacing match
- Build passes
- TypeScript passes"
```

---

## 8. Configuration for Antigravity AI

### Tool Mapping
| Task | Tool/Method |
|------|------------|
| Read files | Built-in file reading |
| Create components | Generate TypeScript/React |
| Verify styles | Design system checklist |
| Run tests | Shell execution |
| Git operations | After user approval |

### Behavior Mode
- **Design-First**: Read design system BEFORE generating
- **User-Approved**: Wait for user to approve git operations
- **Verification-Required**: Always build and test before committing
- **Documentation-Aware**: Reference design system in all explanations

### Constraints
```
MUST:
✓ Read .claude/design-system.md before any component work
✓ Use design system colors/icons/typography
✓ Run build verification
✓ Run type checking
✓ Ask user before pushing

NEVER:
✗ Use colors outside the palette
✗ Use icons not from lucide-react
✗ Hardcode styles without design system approval
✗ Push to git without user confirmation
✗ Modify design system without approval
✗ **Expect changes to show on port 8000 without `npm run build`** (Port 8000 = Static Build)
```

---

## 9. Documentation & Communication

### When Creating Components
```
"I've created [ComponentName] following the design system:

**Colors Used:**
- Background: Dark Grey (#374151)
- Text: White (#ffffff)
- Border: Very Dark Grey (#1f2937)

**Icons:**
- FileUp (from lucide-react)

**Spacing:**
- Gap: gap-2
- Padding: p-3

**States:**
- Hover: hover:bg-black
- Disabled: disabled:opacity-30

**Build Status:** ✓ Passed"
```

### When Requesting Review
```
"Component ready for review:
- Design system compliance: ✓
- Colors from palette: ✓
- Icons from lucide-react: ✓
- Build passed: ✓
- TypeScript passed: ✓

Ready to commit?"
```

---

## 10. Error Recovery

### Color Mismatch
If agent generates wrong color:
```
Error: Color #123456 not in design system
→ Read .claude/design-system.md
→ Replace with correct hex from palette
→ Rebuild and verify
```

### Missing Icon
If icon can't be imported:
```
Error: Icon not in lucide-react
→ Check .claude/design-system.md for alternatives
→ Use similar icon from lucide-react
→ Rebuild and verify
```

### Build Failure
If build fails:
```
→ Check TypeScript errors (npx tsc --noEmit)
→ Verify all imports are correct
→ Check design system compliance
→ Fix and rebuild
→ Never push broken code
```

---

## 11. Links & Resources

- **Design System**: `.claude/design-system.md` (READ FIRST)
- **Project Rules**: `CLAUDE.md`
- **Architecture**: `.claude/project-knowledge/architecture.md`
- **Patterns**: `.claude/project-knowledge/patterns.md`
- **Current Task**: `.claude/current-task.md`
- **Memory**: `.claude/projects/bastbanpem/memory/MEMORY.md`

---

## 12. Version & Status

**Version**: 1.0  
**Status**: ACTIVE — All agents must follow  
**Last Updated**: 2026-04-17  
**Maintained By**: Design System Authority  

**Golden Rule**: When in doubt, read `.claude/design-system.md`

---

## Appendix: Color Reference

| Type | Hex | Usage |
|------|-----|-------|
| Success BG | #374151 | Success toasts, positive actions |
| Success Text | #ffffff | Text on success background |
| Info BG | #6b7280 | Info toasts, secondary state |
| Info Text | #ffffff | Text on info background |
| Warning BG | #f3f4f6 | Warning toasts, caution state |
| Warning Text | #374151 | Text on warning background |
| Error BG | #1f2937 | Error toasts, destructive actions |
| Error Text | #ffffff | Text on error background |
| Primary BG | #374151 | Button backgrounds, accents |
| Light BG | #f3f4f6 | Secondary backgrounds |
| Border | #6b7280 | Element borders |
| Text Primary | #1f2937 | Main text color |
| Text Secondary | #6b7280 | Secondary text |

---

**This is your north star for all autonomous agent development. Follow it religiously.**
