# Design Spec: Hybrid Batch Submission Engine [EXPERT-003]

**Date:** April 15, 2026  
**Status:** Approved  
**Logical ID:** `[AUTO-003]`

## 1. Objective
Automate the submission of multiple recipients (BASTB, Surat Jalan, Photos) to the Government Portal while maintaining 100% data integrity, session stability, and staying within a **4GB RAM target**.

## 2. Architecture: The Hybrid Orchestrator
The engine utilizes a producer-consumer pattern to separate lightweight API tasks from heavyweight browser automation.

### 2.1 Parallel Data Worker (Lightweight)
- **Goal:** Rapidly register recipient metadata (NIK, Name, Qty) on the portal.
- **Technology:** `asyncio` + `requests` (via `PortalService`).
- **Concurrency:** Throttled to 5 simultaneous requests using a semaphore.
- **Impact:** Extremely low RAM overhead (~10MB), high throughput.

### 2.2 Sequential Evidence Worker (Heavyweight)
- **Goal:** High-fidelity document upload (BASTB, SJ, Photos) via the "DO & Bukti Terima" modal.
- **Technology:** `Playwright` (Chromium).
- **Concurrency:** Strictly sequential (1 instance at a time).
- **Impact:** Stable memory usage (~300-400MB), prevents session collisions on the portal.

## 3. Component Details

### 3.1 BatchWorkerService `[AUTO-003-B]`
- **Queue Manager:** Holds the `BatchRequest` (list of NIKs to sync).
- **State Machine:** Tracks progress through `IDLE`, `SYNCING_METADATA`, `UPLOADING_DOCUMENTS`, `COMPLETED`, `FAILED`.
- **Global Lock:** Ensures only one batch operation runs per backend instance.

### 3.2 Error Handling & Resilience
- **Atomic Retries:** 3 attempts per recipient with exponential backoff.
- **Isolation:** A failure for one recipient (e.g., "Invalid NIK format") does not halt the batch.
- **Session Watchdog:** Detects portal session expiry and pauses the worker, triggering a UI notification.

### 3.3 Memory Management (4GB Target)
- **Lazy File Streams:** Documents are only opened at the moment of upload.
- **Explicit Cleanup:** `gc.collect()` and Playwright `context.close()` are called after each recipient's heavy tasks are complete.

## 4. API Interface `[UIUX-001]`

- `POST /portal/batch/start`: Payload: `{"idkontrak": "string", "niks": ["string"]}`.
- `GET /portal/batch/status`: Returns `{"total": 50, "completed": 12, "failed": 1, "status": "UPLOADING_DOCUMENTS", "errors": []}`.
- `POST /portal/batch/cancel`: Safely stops the queue and closes browser instances.

## 5. UI Integration `[UIUX-005]`
- **Control:** "Batch Sync All" button in `PortalSyncModule`.
- **Feedback:** Real-time progress overlay with a task-by-task log and a "Safe Stop" button.

## 6. Success Criteria
- 50+ recipients synced in a single operation without backend crashes.
- Peak RAM usage remains below 1.5GB (total system load < 4GB).
- 0% data corruption across document-to-recipient bindings.
