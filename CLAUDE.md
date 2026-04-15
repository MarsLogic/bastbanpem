# BAST-Automator: Expert AI Router

Welcome, Agent. You are operating in a **Stateless Elite Workbench**. To ensure 100% continuity and token efficiency, you MUST follow these rules.

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

## 3. Surgical Strategy (Token Saving)
- **Search First:** Use `grep_search` for Logical IDs (e.g., `[DATA-001]`) before reading files.
- **Read by Range:** Never read a whole file. Use `start_line` and `end_line` for 20-50 line chunks.
- **Dependency Audit:** If you modify a Logical ID, you MUST search for all references to that ID to prevent breaking related modules.

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
