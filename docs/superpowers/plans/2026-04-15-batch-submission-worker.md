# [EXPERT-003] Hybrid Batch Submission Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a high-fidelity, memory-efficient batch worker for government portal submissions.

**Architecture:**
- **Parallel API Worker:** Rapid metadata sync using `asyncio` and `requests`.
- **Sequential Playwright Worker:** High-fidelity document uploads using a single browser instance.
- **SQLite Persistence:** Real-time task status tracking in `vault_service.py` to support resumes and detailed reporting.

**Tech Stack:** FastAPI, Playwright, asyncio, SQLite, React (Sonner for notifications).

---

### Task 1: Batch Status & Persistence Layer [DATA-005]

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/services/vault_service.py`
- Test: `rtk python -c "from backend.services.vault_service import vault_service; vault_service.save_batch_task('test', '123', 'SYNCED'); print('ok')"`

- [ ] **Step 1: Add Batch models to `backend/models.py`**

```python
from typing import List, Optional
from pydantic import BaseModel

class BatchTaskStatus(BaseModel):
    nik: str
    status: str # PENDING, SYNCED, UPLOADED, FAILED
    error: Optional[str] = None
    timestamp: float

class BatchSummary(BaseModel):
    batch_id: str
    idkontrak: str
    total: int
    completed: int
    failed: int
    status: str # IDLE, RUNNING, COMPLETED
    tasks: List[BatchTaskStatus]
```

- [ ] **Step 2: Initialize `batch_tasks` table in `backend/services/vault_service.py`**
Add this to `__init__` or a setup method:
```python
self.execute("""
CREATE TABLE IF NOT EXISTS batch_tasks (
    batch_id TEXT,
    nik TEXT,
    status TEXT,
    error TEXT,
    timestamp REAL,
    PRIMARY KEY (batch_id, nik)
)
""")
```

- [ ] **Step 3: Implement `save_batch_task` and `get_batch_summary`**
```python
def save_batch_task(self, batch_id: str, nik: str, status: str, error: str = None):
    import time
    query = """
    INSERT INTO batch_tasks (batch_id, nik, status, error, timestamp)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(batch_id, nik) DO UPDATE SET
        status=excluded.status,
        error=excluded.error,
        timestamp=excluded.timestamp
    """
    self.execute(query, (batch_id, nik, status, error, time.time()))

def get_batch_summary(self, batch_id: str) -> List[Dict]:
    return self.query("SELECT * FROM batch_tasks WHERE batch_id = ?", (batch_id,))
```

- [ ] **Step 4: Commit Persistence**
```bash
rtk git add backend/models.py backend/services/vault_service.py
rtk git commit -m "feat: add batch persistence layer [DATA-005]"
```

---

### Task 2: The Hybrid Orchestrator [AUTO-003]

**Files:**
- Create: `backend/services/batch_worker.py`
- Modify: `backend/services/portal_service.py`

- [ ] **Step 1: Create `backend/services/batch_worker.py` with `BatchWorkerService`**
Implement the hybrid logic: burst `requests` for metadata, sequential `playwright` for docs.

```python
import asyncio
import uuid
import time
from typing import List, Dict
from backend.services.portal_service import portal_service
from backend.services.automation_service import submit_to_government_site
from backend.services.vault_service import vault_service
from backend.models import BatchSummary, BatchTaskStatus

class BatchWorkerService:
    def __init__(self):
        self.active_batches: Dict[str, BatchSummary] = {}
        self.semaphore = asyncio.Semaphore(5)

    async def run_batch(self, idkontrak: str, recipients: List[Dict]):
        batch_id = str(uuid.uuid4())
        # Initial state...
        # 1. Parallel Meta Sync
        # 2. Sequential Doc Upload
```

- [ ] **Step 2: Implement `sync_metadata_burst`**
Use `asyncio.gather` with the semaphore to call `portal_service.sync_recipient`.

- [ ] **Step 3: Implement `upload_evidence_sequential`**
Loop through recipients and call `submit_to_government_site`. Ensure `headless=False` is used per expert advice if needed, but for batch, consider `headless=True` to save RAM if stealth works.

- [ ] **Step 4: Commit Worker**
```bash
rtk git add backend/services/batch_worker.py
rtk git commit -m "feat: implement hybrid batch orchestrator [AUTO-003]"
```

---

### Task 3: API & UI Integration [UIUX-005]

**Files:**
- Modify: `backend/api/router.py`
- Modify: `src/lib/api.ts`
- Modify: `src/components/PortalSyncModule.tsx`

- [ ] **Step 1: Add Batch Endpoints to `router.py`**
`/portal/batch/start`, `/portal/batch/status/{batch_id}`.

- [ ] **Step 2: Update `src/lib/api.ts`**
Add `startPortalBatch` and `fetchBatchStatus`.

- [ ] **Step 3: Enhance `PortalSyncModule.tsx` UI**
Add "Batch Sync All" button. Implement a polling mechanism for status updates. Use `sonner` for completion alerts.

- [ ] **Step 4: Final Verification**
Run a test batch with 3 recipients. Verify RAM stays < 1.5GB and SQLite logs are correct.

- [ ] **Step 5: Commit UI**
```bash
rtk git add backend/api/router.py src/lib/api.ts src/components/PortalSyncModule.tsx
rtk git commit -m "feat: integrate batch submission UI [UIUX-005]"
```
