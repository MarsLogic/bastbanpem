import asyncio
import uuid
import json
import logging
import gc
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from backend.services.vault_service import vault_service
from backend.services.data_engine import ingest_excel_to_models, PipelineRow
from backend.services.cleaner_service import cleaner_service

logger = logging.getLogger("alignment_worker")

class AlignmentWorkerService:
    def __init__(self):
        self.active_jobs: Dict[str, datetime] = {} # job_id -> last_poll_time
        self.cancelled_jobs: set = set()
        self.LEASE_SECONDS = 30 # Terminate if no status poll in 30s

    async def run_alignment_task(self, job_id: str, contract_id: str, file_content: bytes, sheet_name: Optional[str] = None):
        """
        Expert Background Alignment Loop:
        1. Parse Excel via Polars.
        2. Process in chunks.
        3. Check heartbeat lease.
        4. Update SQLite status.
        """
        try:
            # Update initial status
            vault_service.update_alignment_progress(job_id, 0, status="RUNNING")
            self.active_jobs[job_id] = datetime.now()

            # 1. Load Data via Data Engine (already optimized with fastexcel/polars)
            # ingest_excel_to_models returns ExcelIngestResult
            result = await asyncio.to_thread(ingest_excel_to_models, file_content, sheet_name)
            rows: List[PipelineRow] = result.rows
            total = len(rows)
            
            vault_service.update_alignment_progress(job_id, 0, status="RUNNING")
            vault_service.save_alignment_job(job_id, contract_id, "RUNNING", total=total)

            processed_rows = []
            chunk_size = 50
            
            for i in range(0, total, chunk_size):
                # HEARTBEAT CHECK [EXPERT-GAARD]
                if not self._is_lease_valid(job_id):
                    logger.warning(f"Job {job_id} lease expired. Terminating background task.")
                    vault_service.update_alignment_progress(job_id, i, status="CANCELLED")
                    return

                if job_id in self.cancelled_jobs:
                    logger.info(f"Job {job_id} received cancel signal. Terminating.")
                    vault_service.update_alignment_progress(job_id, i, status="CANCELLED")
                    self.cancelled_jobs.remove(job_id)
                    return

                chunk = rows[i:i+chunk_size]
                
                # Apply Cleaner Service (Python side) for extra hygiene
                for row in chunk:
                    row.name = cleaner_service.to_title_case(row.name)
                    if row.group: row.group = cleaner_service.to_title_case(row.group)
                    # Sync location suggestions or other backend-only logic here if needed
                
                processed_rows.extend(chunk)
                
                # Update Progress
                progress = min(i + chunk_size, total)
                vault_service.update_alignment_progress(job_id, progress)
                
                # Yield to event loop
                await asyncio.sleep(0.01)

            # 3. Finalize
            # Convert result rows back to dict for storage
            # PipelineRow models to dict
            final_data = [row.model_dump() for row in processed_rows]
            
            summary = {
                "rows": final_data,
                "headers": result.headers,
                "total_target": result.total_target,
                "sheet_name": result.sheet_name
            }
            
            vault_service.update_alignment_progress(
                job_id, 
                total, 
                status="COMPLETED", 
                result_json=json.dumps(summary, ensure_ascii=False)
            )
            
            logger.info(f"Job {job_id} for contract {contract_id} completed successfully.")
            
        except Exception as e:
            logger.error(f"Alignment job {job_id} failed: {e}")
            vault_service.update_alignment_progress(job_id, 0, status="FAILED", error=str(e))
        finally:
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]
            gc.collect()

    def update_heartbeat(self, job_id: str):
        """Update last poll time to keep lease active."""
        if job_id in self.active_jobs:
            self.active_jobs[job_id] = datetime.now()

    def cancel_job(self, job_id: str):
        self.cancelled_jobs.add(job_id)

    def _is_lease_valid(self, job_id: str) -> bool:
        if job_id not in self.active_jobs:
            return False
        return (datetime.now() - self.active_jobs[job_id]) < timedelta(seconds=self.LEASE_SECONDS)

alignment_worker = AlignmentWorkerService()
