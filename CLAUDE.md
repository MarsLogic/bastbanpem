# BAST-Automator: Expert AI Router

Welcome, Agent. You are operating in a **Stateless Elite Workbench**. To ensure 100% continuity and token efficiency, you MUST follow these rules.

## 0. Session Initialization (AI Learning System)

**On every new session, do this FIRST (before Pulse Check):**

1. **Check for active task:** `ls -la .claude/current-task.md`
   - If exists: Read it. This is your surgical context.
   - If missing: You can explore, but ask user what to work on next.

2. **Load project knowledge (5 min read):**
   - `.claude/project-knowledge/architecture.md` — How the system is structured
   - `.claude/project-knowledge/patterns.md` — Coding patterns to follow
   - `.claude/project-knowledge/decisions.md` — Why we built it this way
   - `.claude/project-knowledge/lessons-learned.md` — What worked, what didn't

3. **Load memory index:**
   - `.claude/projects/[project]/memory/MEMORY.md` — Points to all project memories
   - Reference memories as needed during work

**Why?** These files contain institutional knowledge. Reading them prevents:
- ❌ AI re-reading the whole codebase every session
- ❌ AI making decisions that contradict past choices
- ❌ AI wasting tokens on exploration
- ✅ AI working surgically, getting smarter over time

**This makes AI act like a Hermes agent** — each session is smarter than the last because it learns from what came before.

## 1. Mandatory Session Start (Pulse Check)
Before taking ANY action, you must run these commands to sync your mental map:
1. `rtk git log -n 1` - Identify the last physical change.
2. `cat docs/internal/STATE.md` - Identify current milestone and "Logic Ripples."
3. `cat docs/internal/LOGICAL_MAP.md` - Understand the system's "Barcodes."

## 2. Mandatory Tool Activation
You MUST activate these skills immediately after the Pulse Check:
- `activate_skill("superpowers")` - For design/plan workflows.
- `activate_skill("caveman")` - If the session context exceeds 50k tokens.
- **ALWAYS** prefix shell commands with `rtk` (e.g., `rtk git status`).
- **Ripgrep Integration:** Use `rg` instead of grep for all file searching (100x faster, saves token budget).

## 2.5 Tool Integration Playbook (How They Work Together)

**Activation Sequence (Every Session):**
1. Run Pulse Check (Section 1)
2. Activate superpowers (for structured planning) — always first
3. Activate caveman only if context exceeds 50k tokens — automatic
4. Use ripgrep + rtk as your default search/command pattern

**When to Use Each Tool:**

| Situation | Tool(s) | Why |
|-----------|---------|-----|
| Starting a feature/fix | superpowers | Reduces back-and-forth, tightens prompts |
| Finding a Logical ID ref | `rtk rg "\[DATA-001\]"` | Fast + clean output |
| Context getting bloated | caveman (auto) | Compresses history, maintains state |
| Running git/bash commands | `rtk <command>` | Normalizes output, reduces token waste |
| Checking file without reading | `rg -A 2 "pattern"` in specific dir | Get context lines, not whole file |

**Example Workflow:**
```bash
# 1. Plan with superpowers (if complex task)
# 2. Search with rtk + rg
rtk rg "\[UIUX-001\]"  # Find all refs to API bridge

# 3. Read targeted chunks (not whole files)
# 4. Modify with Logical ID awareness
# 5. Let caveman compress if context > 50k
```

## 3. Surgical Strategy (Token Saving)
- **Search First:** Use `rg` (ripgrep) for Logical IDs (e.g., `rg "\[DATA-001\]"`) before reading files.
- **Ripgrep Over Grep:** Always use `rg` instead of grep/find — 100x faster, minimizes AI context reading.
- **Read by Range:** Never read a whole file. Use `start_line` and `end_line` for 20-50 line chunks.
- **Dependency Audit:** If you modify a Logical ID, use `rg "\[LOGICAL-ID\]"` to find all references before changing code.

## 4. Tech Stack & Mandates
- **Memory:** 4GB RAM Target. Use Polars (Lazy), PyMuPDF (with statements), explicit `gc.collect()`.
- **Backend:** FastAPI (Async) on Port 8000. Use `backend/config.py`.
- **Frontend (Static/Prod):** Served by backend on **Port 8000** from the `dist/` folder.
- **Frontend (Live/Dev):** Served by Vite on **Port 5173** from the `src/` folder.
- **Base URL:** Defined in `src/lib/api.ts`.
- **Context:** Use `repomix-output.xml` ONLY as a last-resort emergency map.

## 4.5 Design System (MANDATORY)
**Before creating or editing ANY component, read:** `.claude/design-system.md`

This covers:
- Color palette (white, grey, light grey, dark grey, very dark grey, black)
- Typography (Geist Sans/Mono, font weights, sizes)
- Icons (Lucide React system, sizes)
- Component patterns (buttons, tables, toasts, badges, highlights)
- Spacing & layout rules
- States & transitions
- Implementation checklist

**Single source of truth** for consistency across all UIs (Claude Code, Claude CLI, Gemini CLI, Antigravity AI).

## 5. Logic Barcodes
Every module has a Logical ID. Use them in your plans and commits.
- `[CORE-###]` - Infrastructure
- `[DATA-###]` - Data Engine
- `[DOCS-###]` - PDF/Image Intel
- `[UIUX-###]` - React Workbench

## 6. Session Closure (Always Do This)

**Before ending the session, if code is working:**

1. **Run tests:**
   ```bash
   npm test          # Frontend
   pytest            # Backend
   ```

2. **Check git status:**
   ```bash
   rtk git status
   rtk git diff
   ```

3. **Mandatory Commit & Push (Every Change):**
   ```bash
   rtk git add .
   rtk git commit -m "[TYPE]: [LOGICAL-ID] Brief description"
   rtk git push origin main
   ```
   **Why?** The user mandates that ALL tiny changes, especially to `.md` files, MUST be pushed to https://github.com/MarsLogic/bastbanpem immediately to ensure all AI sessions stay in sync.

4. **Wait for user approval, then:**
   ```bash
   rtk git push origin main
   ```

**Why?** 
- Keeps GitHub in sync with development
- Prevents lost work
- Creates backup of stable code
- Helps track project progress

**Token Impact:** Pushing (1 command) = negligible. Losing work = catastrophic.

---

**GOAL:** Minimal Tokens. Maximum Stability. Expert Quality.

---

## 🚨 CRITICAL RULE: Always Rebuild Before Session Ends

**When you make ANY code changes:**
1. ✅ **ALWAYS run:** `npm run build`
2. ✅ **VERIFY:** Build completes with ✓
3. ✅ **INFORM USER:** "Build passes ✓ - Changes will show when you run start.bat"
4. ✅ **NEVER assume** changes will appear without explicit build

**This ensures changes appear in ALL modes:**
- Option 1: Production Mode (serves `dist/` on Port 8000 - requires build)
- Option 2: Dev Mode (serves `src/` on Port 5173 - requires build for initial state consistency)
- Option 3: Debug Mode (requires build)

> [!WARNING]
> If you view the app on Port 8000, you are looking at a static build. Changes in `src` will NOT appear there until you run `npm run build`. Always use Port 5173 for live development.

---

## 📍 Key Reminders for Every Session

✅ Load project knowledge first (architecture, patterns, decisions)  
✅ Use task templates for context (not whole codebase)  
✅ Always ripgrep before reading files  
✅ **BUILD & VERIFY before finishing ANY code changes** ← CRITICAL!
✅ Test before closing session  
✅ **Push to GitHub if user approves** ← Important!  
✅ Update lessons-learned.md if you discover something new
