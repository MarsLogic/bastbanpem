# Persistent Mapping Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a self-documenting project structure that allows new AI sessions to instantly regain context while minimizing token usage.

**Architecture:** Use a three-tier mapping system: `CLAUDE.md` (Mission Control), `LOGICAL_MAP.md` (Feature Barcodes), and `STATE.md` (Current Session Progress).

**Tech Stack:** Markdown, Gemini CLI, RTK, ripgrep.

---

### Task 1: Initialize Persistence Documents

**Files:**
- Create: `docs/internal/STATE.md`
- Create: `docs/internal/LOGICAL_MAP.md`
- Modify: `CLAUDE.md`

- [x] **Step 1: Create LOGICAL_MAP.md**
- [x] **Step 2: Create STATE.md**
- [x] **Step 3: Update CLAUDE.md**
- [x] **Step 4: Commit Persistence Docs**

---

### Task 2: Token Sniper Configuration

**Files:**
- Modify: `.gitignore` (ensure .geminiignore is tracked if needed)
- Create: `.geminiignore`

- [ ] **Step 1: Create .geminiignore**
Aggressively filter out token-wasting noise.
```text
node_modules/
.venv/
dist/
artifacts/archive/
output/
__pycache__/
*.db
*.db-shm
*.db-wal
.git/
```

- [ ] **Step 2: Verify Search Efficiency**
Run a `grep_search` and verify it respects the ignore list.
```bash
rtk grep "NIK" --names-only
```

- [ ] **Step 3: Commit Configs**
```bash
git add .geminiignore
git commit -m "perf: [CORE-001] optimize search filters for token efficiency"
```
