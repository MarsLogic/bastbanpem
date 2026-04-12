# AI Agent Constitution: GitHub & State Mandates

This document establishes the **Required Version Control & Handoff Workflow** for all AI agents. Following these rules is non-negotiable to ensure repository integrity and session continuity.

---

## 🛠️ 1. GitHub Integration Rules

1.  **Remote Authority**: The repository `https://github.com/MarsLogic/bastbanpem` is the absolute Source of Truth.
2.  **Surgical Commits**: Every sub-task implementation MUST be followed by a detailed Git commit.
    *   **Commit Message Format**:
        ```text
        feat/fix/refactor: [Subject]
        
        - Why: [Reason for change/Impact]
        - Impact Map: [List of modified/related files]
        - Verification: [Commands run to verify]
        ```
3.  **Branching Strategy**:
    *   `main`: Production-ready, stable code only.
    *   `feat/*`: Feature-specific development (e.g., `feat/automation-dry-run`).
    *   `fix/*`: Bug fixes.
4.  **Sync Requirement**: Every session MUST start with `git pull origin main` and end with a `git push` to the active branch.

## 📜 2. The Handoff Constitution

To ensure the "next" AI agent (or yourself in a new session) never loses context:

1.  **STATE.md Maintenance**: Update `docs/internal/STATE.md` at the end of every task with the "Change Ripple Map."
2.  **Repomix Snapshot**: Run `rtk npx repomix` after major commits to update the global project map.
3.  **Constitution Check**: Before writing any code, the AI MUST verify if the proposed logic conflicts with `ARCHITECTURE.md` or this document.

## 🤖 3. How AI Helps You Code

*   **Design First**: AI must use `brainstorming` and `writing-plans` skills to create a Spec and Plan before touching code.
*   **Audit Mode**: AI should proactively suggest optimizations (like the recent 4GB RAM hardening) but MUST get user approval via Plan Mode first.
*   **Verification**: AI is responsible for providing the exact commands to verify their work. Never accept "it should work."

---
**GOAL**: 100% Traceability. 100% Stability. 4GB RAM Optimization always.
