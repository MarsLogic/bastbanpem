# BAST-Automator: Karpathy-Hardened Singleton Brain

This is the **Singleton Source of Truth**. Replaces AGENTS/GEMINI/DESIGN-SYSTEM.

---

## 1. Operating Identity: The Karpathy Mandate

LLMs fail by over-engineering and making silent assumptions. To counter this, ALL work MUST follow these four principles:

1. **Think Before Coding**:
   - **Ask rather than guess**: If anything is ambiguous, STOP and ask for clarification.
   - **Surface Tradeoffs**: If multiple solutions exist, present them before implementing.
   - **Push Back**: If a request is over-complicated, suggest a simpler approach.

2. **Simplicity First**:
   - **Minimum code**: No speculative features or "flexible" abstractions.
   - **100 vs 1000**: If 1000 lines of code can be 100, rewrite it.
   - **Seniors' Test**: "Would a senior engineer say this is over-complicated?" If yes, simplify.

3. **Surgical Changes**:
   - **Touch only the target**: Don't refactor code, comments, or formatting adjacent to your task.
   - **Own your orphans**: Only remove dead code that YOUR changes made unused.
   - **Match existing style**: Even if you'd do it differently, stay consistent with the room.

4. **Goal-Driven Execution**:
   - **Define Success First**: State a plan with verification steps before touching code.
   - **Loop until Verified**: Transform imperative tasks into declarative goals (e.g., "X is done when Test Y passes").

---

## 2. Mandatory Workflow

- **Global Proxy**: ALWAYS use `rtk` (60-90% token savings).
- **Windows Reliability**: Use `;` for chaining commands. NEVER use `&&`.
- **Closure Checklist**:
  1. Update `LESSONS.md` with new insights.
  2. Define "Success Criteria" for the next session in `.claude/current-task.md`.
  3. Final Build: `rtk npm run build` -> Push to origin.

---

## 3. Design System & Semantics

**Plain Language Policy**: Use grounded, professional terminology. No "Elite" or "Magic" jargon.

### Palette & Checklist
| Style | Background | Text | Border | Usage |
|-------|------------|------|--------|-------|
| Success | #374151 | White | #1f2937 | Validated records |
| Info | #6b7280 | White | #4b5563 | Processing status |
| Warning | #f3f4f6 | #374151| #d1d5db | Reconciliation mismatch |
| Error | #1f2937 | White | #111827 | Hardware/Parsing fail |

**Fidelity Guards**:
- **Icons**: Lucide React (`h-4 w-4` / `h-5 w-5`).
- **Loaders**: `fixed inset-0 z-[100] backdrop-blur-md`. Mandatory scroll lock on `document.body`.
- **Toasts**: Semantic `sonner` styles only.

---

## 4. Surgical Reference
- **Arch & Patterns**: [PROJECT.md](file:///c:/Users/Wyx/bastbanpem/PROJECT.md)
- **Institutional Memory**: [LESSONS.md](file:///c:/Users/Wyx/bastbanpem/LESSONS.md)
- **Active Task**: `.claude/current-task.md`

**VERIFICATION: Every line changed must trace directly to a verified objective.**
