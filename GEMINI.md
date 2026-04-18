# BAST-Automator: Gemini CLI Configuration

Welcome to BAST-Automator's Gemini CLI guide. This ensures parity with Claude Code and Claude CLI development.

---

## Instruction Priority (CRITICAL)

1. **CLAUDE.md** — Highest priority (project rules)
2. **This file (GEMINI.md)** — Gemini-specific overrides
3. **Default system prompt** — Lowest priority

---

## 1. Before Starting ANY Work

### Step 1: Load Design System
```bash
gemini read .claude/design-system.md
```

### Step 2: Load Project Knowledge
```bash
gemini read .claude/project-knowledge/architecture.md
gemini read .claude/project-knowledge/patterns.md
```

### Step 3: Check Current Task
```bash
gemini read .claude/current-task.md
```

### Step 4: Load Memory
```bash
gemini read .claude/projects/bastbanpem/memory/MEMORY.md
```

### Step 5: Verify Port Alignment (CRITICAL)
Check the browser URL the user is viewing:
- `http://localhost:5173`: Live Dev (sees `src/` changes immediately)
- `http://127.0.0.1:8000`: Static Build (sees `dist/` - **Requires Build**)

---

## 2. Tool Mapping (Gemini → Claude Code)

| Task | Claude Code | Gemini CLI |
|------|-------------|-----------|
| Read files | `Read` | `read` tool |
| Edit files | `Edit` | `replace_content` + symbolic tools |
| Create files | `Write` | `create_text_file` |
| Search patterns | `Grep` | `search_for_pattern` |
| Find files | `Glob` | `find_file` + `list_dir` |
| Run commands | `Bash` | `execute_shell_command` |
| Symbols/code structure | Plan mode tools | `find_symbol`, `get_symbols_overview` |
| Git commands | `Bash` | `execute_shell_command` with `rtk` prefix |

---

## 3. Mandatory Activation (Every Session)

### A. Activate Serena (Required)
```bash
activate_skill("serena")
```
This gives you semantic code tools (find_symbol, replace_content, etc.)

### B. Always Use RTK Prefix
```bash
rtk git status
rtk git log -n 1
rtk rg "pattern"
```

### C. Load Design System
Before any component work:
```bash
gemini read .claude/design-system.md
```

---

## 4. Component Development Rules

### Colors (MANDATORY)
Use ONLY colors from `.claude/design-system.md`:
```python
# ✅ GOOD
toast_bg = "#374151"  # Dark grey
toast_text = "#ffffff"  # White

# ❌ WRONG
toast_bg = "#123456"  # Random hex
```

### Icons
Always use Lucide React:
```typescript
import { FileUp, Zap, AlertCircle } from 'lucide-react';
```

### Typography
Use Geist Sans/Mono (defined in `src/index.css`):
```typescript
className="font-sans text-[10px]"
className="font-mono text-[11px]"
```

### Toast Messages
Apply semantic colors:
```python
# Success
toast.success('Message', style={
    'backgroundColor': '#374151',  # Dark grey
    'color': '#ffffff',            # White
    'border': '1px solid #1f2937', # Very dark grey
})
```

---

## 5. File Organization

```
bastbanpem/
├── .claude/
│   ├── design-system.md          ← READ THIS FIRST
│   ├── current-task.md           ← Check for active work
│   ├── project-knowledge/        ← Architecture, patterns
│   └── projects/bastbanpem/memory/ ← Institutional knowledge
├── CLAUDE.md                      ← Project rules
├── GEMINI.md                      ← This file
├── src/
│   ├── components/
│   │   ├── PdfSyncModule.tsx      ← Design system example
│   │   ├── ui/
│   │   │   └── sonner.tsx         ← Toast config
│   │   └── pdf-sync/              ← Follow design patterns
│   ├── lib/
│   │   ├── api.ts                 ← Backend endpoints
│   │   └── contractStore.ts       ← State management
│   └── index.css                  ← Font definitions
```

---

## 6. Workflow Template

### New Feature
```bash
# 1. Read design system
gemini read .claude/design-system.md

# 2. Read architecture
gemini read .claude/project-knowledge/architecture.md

# 3. Get symbols overview
serena get_symbols_overview [file]

# 4. Make changes with semantic tools
serena replace_content [file] [pattern] [replacement]

# 5. Build & test
rtk npm run build
rtk npm test
```

### Bug Fix
```bash
# 1. Load task
gemini read .claude/current-task.md

# 2. Understand component
serena find_symbol [component_name] [file]

# 3. Fix with design compliance
# (Ensure colors/icons/typography match design system)

# 4. Test & commit
rtk npm run build
rtk git commit -m "fix: ..."
```

---

## 7. Design Compliance Checklist

Before committing ANY component changes:

- [ ] Colors from `.claude/design-system.md` palette
- [ ] Icons from lucide-react only
- [ ] Typography: `font-sans`/`font-mono` with correct sizes
- [ ] Spacing: `gap-*`, `p-*` from Tailwind scale
- [ ] Buttons follow primary/secondary patterns
- [ ] Toast messages use semantic colors
- [ ] Tables have alternating rows
- [ ] Hover/disabled states included
- [ ] No hardcoded hex colors outside design system
- [ ] Build passes: `rtk npm run build`
- [ ] No TypeScript errors: `rtk npx tsc --noEmit`

---

## 8. CI/CD & Git Integration

### Before Pushing
```bash
# 1. Verify build
rtk npm run build

# 2. Run tests
rtk npm test

# 3. Commit & Push (MANDATORY for all .md changes)
rtk git add .
rtk git commit -m "docs: [UIUX-###] immediate push for sync"
rtk git push origin main
```
**CRITICAL**: Every tiny change to documentation (`.md` files) MUST be pushed immediately to https://github.com/MarsLogic/bastbanpem.

### Commit Format
```
[TYPE]: [LOGICAL-ID] Brief description

Longer explanation if needed.

Co-Authored-By: Gemini CLI <noreply@anthropic.com>
```

---

## 9. Common Tasks & Examples

### Add New Toast Notification
1. Read design system (toast section)
2. Use semantic color mapping
3. Apply to all toast calls in file
4. Build & test

### Create New Component
1. Read design system
2. Use button/table/badge patterns
3. Import from lucide-react
4. Use Geist Sans typography
5. Apply color palette
6. Add hover/disabled states

### Modify Existing Component
1. Check design system for patterns
2. Ensure color consistency
3. Verify icon sizing
4. Test hover states
5. Run build

---

## 10. Links & References

- **Design System**: `.claude/design-system.md`
- **Architecture**: `.claude/project-knowledge/architecture.md`
- **Patterns**: `.claude/project-knowledge/patterns.md`
- **Memory Index**: `.claude/projects/bastbanpem/memory/MEMORY.md`
- **Task Status**: `.claude/current-task.md`

---

## 11. Troubleshooting

### Colors Don't Match
→ Read `.claude/design-system.md` color section
→ Use exact hex values from palette

### Icon Not Showing
→ Check lucide-react import
→ Verify size classes: `h-4 w-4`, `h-5 w-5`, etc.

### Styling Issues
→ Use Tailwind classes from design system
→ No custom CSS unless design system approved

### Build Fails
→ Check TypeScript: `rtk npx tsc --noEmit`
→ Verify icon imports
→ Confirm color hex values

---

**Version**: 1.0  
**Status**: ACTIVE  
**Last Updated**: 2026-04-17  

**Remember**: When in doubt, read `.claude/design-system.md` first.
