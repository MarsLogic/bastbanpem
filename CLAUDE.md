# BAST-Automator: The Constitution (Operating Manual)

This is the **Singleton Source of Truth** for AI Behavior and Operations.

---

## 1. Operating Identity: The Karpathy Mandate

LLMs fail by over-engineering. To counter this, ALL work MUST follow these protocols:

1.  **Think Before Coding**:
    - **Ask rather than guess**: If anything is ambiguous, STOP and ask for clarification.
    - **Surface Tradeoffs**: If multiple solutions exist, present them before implementing.
    - **Push Back**: If a request is over-complicated, suggest a simpler approach.

2.  **Simplicity First**:
    - **Minimum code**: No speculative features or "flexible" abstractions.
    - **Surgical Mandate**: Only read what you need to discover (use fragment reads).
    - **100 vs 1000**: If 1000 lines of code can be 100, rewrite it.

3.  **Surgical Changes**:
    - **Touch only the target**: Don't refactor adjacent code or formatting.
    - **Own your orphans**: Remove dead code that YOUR changes made unused.
    - **Match existing style**: Stay consistent with the current room.

4.  **Goal-Driven Execution**:
    - **Define Success First**: State a plan with verification steps before touching code.
    - **Loop until Verified**: Transform imperative tasks into declarative goals.

---

## 2. Mandatory Workflow & CLI Shell

- **Global Proxy**: **ALWAYS** use `rtk` prefix for every CLI command.
- **Windows Shell**: System is Windows. Use `;` for chaining. **NEVER use `&&`**.
- **Reflexive Learning**: Any command failure or syntax friction MUST be documented in `LESSONS.md` immediately.

### 🛡️ CLI Golden Syntax (Anti-Friction Registry)

| Component/Tool | Wrong/Invalid Format | Golden/Correct Format (This Env) | Why? |
| :--- | :--- | :--- | :--- |
| **Command Chaining** | `cmd1 && cmd2` | `cmd1; cmd2` | PowerShell does not support `&&`. |
| **Search Engine** | `rtk grep` / `grep` | `rtk rg` (ripgrep) | Native to the expert stack. |
| **Framer Motion** | `mode="white"` | `mode="wait"` | Typos freeze the `dist` folder. |
| **File Reading** | `view_file` (Full) | `view_file` (Range: 50L) | Compliance with Surgical Mandate. |
| **Pathing** | `/abs/path/` (Linux) | `C:\Users\...` (Windows) | System is Windows (Backslashes). |

---

## 3. Design System & Semantics

**Plain Language Policy**: Use grounded, professional terminology. (No "Elite" or "Magic" jargon).

### Palette & Checklist
| Style | Background | Text | Border | Usage |
| :--- | :--- | :--- | :--- | :--- |
| Success | #374151 | White | #1f2937 | Validated records |
| Info | #6b7280 | White | #4b5563 | Processing status |
| Warning | #f3f4f6 | #374151 | #d1d5db | Reconciliation mismatch |
| Error | #1f2937 | White | #111827 | Parsing failure |

**Fidelity Guards**:
- **Icons**: Lucide React (`h-4 w-4` / `h-5 w-5`).
- **Loaders**: `fixed inset-0 z-[100] backdrop-blur-md`. Mandatory scroll lock.
- **Toasts**: Semantic `sonner` styles only.

---

## 4. Institutional Continuity
- **Project Almanac**: [PROJECT.md](file:///c:/Users/Wyx/bastbanpem/PROJECT.md)
- **Active Mission**: [STATE.md](file:///c:/Users/Wyx/bastbanpem/STATE.md)
- **Learning Hub**: [LESSONS.md](file:///c:/Users/Wyx/bastbanpem/LESSONS.md)

**VERIFICATION: Every line changed must trace directly to a verified objective.**
