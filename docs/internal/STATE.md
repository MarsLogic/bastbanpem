# Session Handoff — April 12, 2026

## 📍 Current Status
- **Evidence Bundling**: 100% Ported to Python. Ready for production use.
- **Legacy Cleanup**: 100% Complete. Root-level sanitized, TS parsers removed, start command unified.
- **Location Service**: Live with 83k entry master registry.
- **Automation Service**: Playwright Stealth initialized with login/submission field mapping placeholders.
- **UI**: "Inject to Gov" button fully wired to backend automation endpoint.
- **Backend**: `/automation/submit` endpoint ready to trigger Playwright logic.

## 🛠️ Changes in this Session
1.  **Documentation Consolidation**: Moved all system and AI docs to `docs/internal/`.
2.  **Constitution Established**: Created `docs/internal/CONSTITUTION.md` to force AI quality.
3.  **Code Purge**: Deleted legacy TypeScript parsers and root-level garbage files.
    - Added to Purge List: `src-tauri/`, `app.py`, `smartbind11_analysis.txt`, `smartbind_workbench.bat`, `vendor_tool_plan.md`.
    - Flagged Deadwood: `src/lib/assist_script.js` (L96) contains legacy `invoke()` call.
4.  **Research Cleanup**: Moved miscellaneous scripts to `scripts/research/`.
5.  **Automation Readiness**: Initialized `backend/services/automation_service.py` with stealth mode, logging, and field mapping placeholders.
6.  **UI Injection**: Integrated and wired "Inject to Gov" button in `ReconciliationTab.tsx`.
7.  **API Bridge**: Verified `submitAutomation` in `src/lib/api.ts` and wired frontend triggers.
8.  **Legacy Audit**: Created `scripts/research/legacy_audit.txt` to map deadwood.

## ⚠️ Critical Context
- **Models**: OCR models must live in `models/v4/` and `models/v5/`.
- **API**: The frontend now communicates exclusively via `axios` to FastAPI (Port 8000).
- **RAM**: Always keep 4GB RAM optimization in mind. Avoid large file copies.

## 📋 Immediate Next Tasks
1.  **Task 7.1**: Implement a "Dry Run" mode in `automation_service.py` that only performs login and captures a screenshot without submitting data.
2.  **Task 7.2**: Add a "Vault" viewer in the UI to inspect saved contracts and their reconciliation history.
