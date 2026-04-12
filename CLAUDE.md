<!-- rtk-instructions v2 -->
# BAST-Automator: Developer Hub

## ⚠️ MANDATORY: AI AGENT CONSTITUTION
All AI agents MUST read and follow the centralized documentation in **`docs/internal/`** before any implementation.

1.  **[CONSTITUTION.md](./docs/internal/CONSTITUTION.md)**: Rules, Tools, and Skills.
2.  **[ARCHITECTURE.md](./docs/internal/ARCHITECTURE.md)**: Tech Stack and Data Models.
3.  **[ROADMAP.md](./docs/internal/ROADMAP.md)**: Milestones and Progress.
4.  **[STATE.md](./docs/internal/STATE.md)**: Current Session Status.

---

# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule
**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged.

```bash
# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## Token Savings Overview
| Category | Typical Savings |
|----------|-----------------|
| Tests (vitest) | 99.5% |
| Build (tsc/lint) | 70-87% |
| Git (status/diff) | 59-80% |
| Package Managers | 70-90% |

---

## Elite Workbench Mandate

1.  **Single Entry Point**: `start.bat` is the ONLY authorized way to run or build this app.
2.  **Forensic First**: Ensure all new services are hooked into `backend/services/diagnostics.py`.
3.  **Hardware Awareness**: Always optimize for **4GB RAM**. Use `Polars` and `PyMuPDF`.
