# BAST-Automator: Expert AI Router & Singleton Brain

Welcome, Agent. You are operating in a **Stateless Elite Workbench**. To ensure 100% continuity and token efficiency, you MUST follow these rules. This file is the **Single Source of Truth** for all rules.

## 0. Session Initialization (Mandatory)

**On every new session, do this FIRST:**

1. **Check for active task:** `.claude/current-task.md`
2. **Load project knowledge:**
   - `.claude/project-knowledge/architecture.md` (System structure)
   - `.claude/project-knowledge/patterns.md` (Coding standards)
   - `.claude/project-knowledge/lessons-learned.md` (Self-Learning Hub)
3. **Load memory index:**
   - `.claude/projects/[project]/memory/MEMORY.md` (Deep context)

---

## 0.5 The Self-Learning & Surgical Mandate (CRITICAL)

### 🧠 Cumulative Self-Learning
1.  **Strict CRC Protocol**: Every session MUST contribute to `.claude/project-knowledge/lessons-learned.md`.
2.  **Immediate Pull/Push**: Documentation (CLAUDE.md, lessons-learned.md) MUST be synchronized to GitHub immediately after any rule update or major [LEARN] entry.
3.  **Knowledge Debt Auditor**: NEVER commit a major logic refactor or bugfix without an accompanying `[LEARN-###]` entry. Code without documentation is "Amnesia-prone" and is considered an expert-level failure.

### ✂️ Surgical Context (Token ROI)
1.  **Surgical Escalation**: NEVER read a full file > 200 lines if a specific method is the target.
2.  **Tooling Protocol**: 
    -   **Discovery**: `python tools/intel.py list <file>` to map method boundaries.
    -   **Capture**: `python tools/intel.py read <file> <method>` to ingest ONLY the required code.
    -   **Intelligence**: `python tools/indexer.py search <query>` to find logic snippets across the codebase.
3.  **Caveman Ingestion**: For large logs or text files, use a scrubbing script to strip noise (headers, repeated metadata) BEFORE ingestion to prevent context pollution.

**The High-Fidelity Structure**: Use the following "Expert Format" for learning entries:
   ```markdown
   ### Improvement: [LEARN-###] Title
   **Context**: Why was this needed? State of the system before the fix.
   **Action**: What was done? (Link to logic/files).
   **Risk Identified**: What corner cases were caught? (e.g. layout artifacts).
   **Consequences**: Long-term impact on the system.
   **Expert Insight**: A permanent rule for future AI sessions to follow.
   ```
3. **Immediate Push**: ANY change to documentation (`.md` files) MUST be pushed to GitHub immediately via `rtk` WITHOUT waiting for a separate approval.

---

## 1. Mandatory Workflow & Sync

1. **Global Prefix:** ALWAYS use `rtk` for all shell commands (e.g., `rtk git status`).
2. **Search First:** Always use `rtk rg` (ripgrep) for searching before reading large files.
3. **Build & Verify:** NEVER conclude a code change without running `rtk npm run build` and verifying completion.
4. **Port Awareness:** 
   - Port **5173** = Live Development (reflects `src` changes instantly).
   - Port **8000** = Static Production (requires `npm run build` to reflect changes).

---

## 2. Design System & Component Mandates

**Single Source of Truth:** `.claude/design-system.md` (Read EVERY time before UI work).

### Color Palette (MANDATORY)
| Type | Hex | Usage |
|------|-----|-------|
| Success | #374151 | Dark grey backgrounds |
| Info | #6b7280 | Grey backgrounds |
| Warning | #f3f4f6 | Light grey backgrounds |
| Error | #1f2937 | Very dark grey backgrounds |
| Text | #ffffff | On dark backgrounds |
| Main Text| #1f2937 | Primary text color |

### Design Standards:
- **Icons**: Lucide React only (Sizes: `h-4 w-4` or `h-5 w-5`).
- **Typography**: Geist Sans/Mono with Tailwind text scaling (`text-[10px]`, `text-[11px]`).
- **Toasts**: Always use semantic styles (Background: #374151 or #1f2937).
- **Patterns**: No hardcoded hex codes. Use Tailwind + Design System tokens.
- **Brand Fidelity**: NEVER introduce new colors (rainbow colors) without checking against the defined palette. All UI/UX changes MUST adhere to existing `Slate`, `Zinc`, or `Gray` neutral themes.

---

## 3. Surgical Strategy (Token Saving)
- **Lazy Loading:** Use Polars (Lazy) for all large data operations.
- **Read by Range:** Never read whole files. Target 50-line chunks.
- **Logic Barcodes:** Include Logical IDs in all plans and commits:
  - `[CORE-###]` Infrastructure
  - `[DATA-###]` Data Engine
  - `[DOCS-###]` PDF/Image Intel
  - `[UIUX-###]` React Workbench

---

## 4. Session Closure (The Hand-off)

**Before ending the session:**

1. **Update Learning Hub**: Ensure `lessons-learned.md` reflects this session's insights.
2. **Build Verification**: Run `rtk npm run build`.
3. **Communicate Build Status**: "Build passes ✓ - Ready for production."
4. **Final Push**:
   ```bash
   rtk git add .
   rtk git commit -m "[TYPE]: [LOGICAL-ID] Brief description"
   rtk git push origin main
   ```

**GOAL:** Minimal Tokens. Maximum Stability. Cumulative Intelligence.

✅ Update lessons-learned.md if you discover something new
