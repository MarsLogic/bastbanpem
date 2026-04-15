import asyncio
import uuid
import logging
import gc
from typing import List, Dict, Optional, Set
from datetime import datetime
from backend.services.portal_service import portal_service
from backend.services.automation_service import submit_to_government_site
from backend.services.vault_service import vault_service
from backend.models import BatchSummary, BatchTaskStatus

logger = logging.getLogger("batch_worker")

class BatchWorkerService:
    def __init__(self):
        self.active_batches: Dict[str, str] = {} # batch_id -> status
        self.cancelled_batches: Set[str] = set()
        self.semaphore = asyncio.Semaphore(5) # Max 5 concurrent API requests

    async def run_batch(self, idkontrak: str, recipients: List[Dict], batch_id: Optional[str] = None):
        """
        Expert Hybrid Orchestrator:
        1. Burst Sync (Parallel API) for metadata.
        2. Sequential Evidence Upload (Playwright).
        """
        if not batch_id:
            batch_id = str(uuid.uuid4())
            
        total = len(recipients)
        logger.info(f"Starting batch {batch_id} for contract {idkontrak} with {total} recipients")
        
        # Step 1: Parallel Metadata Sync
        for r in recipients:
            if batch_id in self.cancelled_batches: break
            vault_service.save_batch_task(batch_id, r['nik'], "PENDING", idkontrak=idkontrak)
        
        if batch_id not in self.cancelled_batches:
            meta_tasks = [self._sync_metadata_task(batch_id, idkontrak, r) for r in recipients]
            await asyncio.gather(*meta_tasks)
        
        # Step 2: Sequential Evidence Upload
        for r in recipients:
            if batch_id in self.cancelled_batches:
                logger.info(f"Batch {batch_id} cancelled during evidence phase.")
                break
                
            if r.get('evidence') and any(r['evidence'].values()):
                await self._upload_evidence_task(batch_id, idkontrak, r)
                # Cleanup every 5 uploads to stay within 4GB RAM target
                if recipients.index(r) % 5 == 0:
                    gc.collect()

        if batch_id in self.cancelled_batches:
            self.cancelled_batches.remove(batch_id)
            logger.info(f"Batch {batch_id} cleanup complete.")
        else:
            logger.info(f"Batch {batch_id} completed successfully.")
            
        return batch_id

    async def _sync_metadata_task(self, batch_id: str, idkontrak: str, recipient: Dict):
        if batch_id in self.cancelled_batches: return
        
        async with self.semaphore:
            nik = recipient['nik']
            try:
                # First register if missing (Safe Duplicate)
                await asyncio.to_thread(portal_service.register_recipient, {
                    "nik": nik,
                    "name": recipient['name']
                })
                
                # Then sync contract details
                res = await asyncio.to_thread(portal_service.sync_recipient, idkontrak, {
                    "nik": nik,
                    "name": recipient['name'],
                    "qty": recipient['financials']['qty'],
                    "value": recipient['financials']['target_value']
                })
                
                if res.get('status') == 'success':
                    vault_service.save_batch_task(batch_id, nik, "SYNCED")
                else:
                    vault_service.save_batch_task(batch_id, nik, "FAILED", error=res.get('message'))
            except Exception as e:
                logger.error(f"Metadata sync failed for {nik}: {e}")
                vault_service.save_batch_task(batch_id, nik, "FAILED", error=str(e))

    async def _upload_evidence_task(self, batch_id: str, idkontrak: str, recipient: Dict):
        if batch_id in self.cancelled_batches: return
        
        nik = recipient['nik']
        try:
            # Inject idkontrak into data for automation service
            payload = {**recipient, "idkontrak": idkontrak}
            res = await submit_to_government_site(payload)
            
            if res.get('status') == 'success':
                vault_service.save_batch_task(batch_id, nik, "UPLOADED")
            else:
                vault_service.save_batch_task(batch_id, nik, "FAILED", error=res.get('message'))
        except Exception as e:
            logger.error(f"Evidence upload failed for {nik}: {e}")
            vault_service.save_batch_task(batch_id, nik, "FAILED", error=str(e))

    def cancel_batch(self, batch_id: str):
        self.cancelled_batches.add(batch_id)
        logger.info(f"Cancellation signal sent for batch {batch_id}")

    def get_status(self, batch_id: str) -> Optional[BatchSummary]:
        return vault_service.get_batch_summary(batch_id)

batch_worker = BatchWorkerService()
