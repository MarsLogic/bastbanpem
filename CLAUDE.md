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
- **Frontend:** React 19 + Vite. Base URL in `src/lib/api.ts`.
- **Context:** Use `repomix-output.xml` ONLY as a last-resort emergency map.

## 5. Logic Barcodes
Every module has a Logical ID. Use them in your plans and commits.
- `[CORE-###]` - Infrastructure
- `[DATA-###]` - Data Engine
- `[DOCS-###]` - PDF/Image Intel
- `[UIUX-###]` - React Workbench

---
**GOAL:** Minimal Tokens. Maximum Stability. Expert Quality.
