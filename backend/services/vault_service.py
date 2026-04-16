# [DATA-003] SQLite Contract Storage
import json
from typing import List, Optional
from datetime import datetime
from backend.db import db
from backend.models import PipelineRow, ReconciliationResult, BatchTaskStatus, BatchSummary, ContractMetadata

class VaultService:
    def __init__(self):
        self._init_batch_table()

    @staticmethod
    def _init_batch_table():
        with db.get_cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS batch_tasks (
                    batch_id TEXT,
                    idkontrak TEXT,
                    nik TEXT,
                    status TEXT,
                    error TEXT,
                    timestamp TEXT,
                    PRIMARY KEY (batch_id, nik)
                )
            """)

    @staticmethod
    def save_contract(id: str, name: str, target_value: float, metadata: Optional[ContractMetadata] = None):
        meta_json = metadata.model_dump_json() if metadata else "{}"
        with db.get_cursor() as cursor:
            cursor.execute(
                "INSERT OR REPLACE INTO contracts (id, name, target_value, status, metadata) VALUES (?, ?, ?, ?, ?)",
                (id, name, target_value, "ACTIVE", meta_json)
            )

    @staticmethod
    def get_contract(id: str) -> Optional[dict]:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT * FROM contracts WHERE id = ?", (id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def save_recipients(contract_id: str, rows: List[PipelineRow]):
        with db.get_cursor() as cursor:
            # Efficient bulk insert
            data = [
                (
                    row.id, 
                    contract_id, 
                    row.nik, 
                    json.dumps(row.original_row) if hasattr(row, 'original_row') else "{}", 
                    json.dumps(row.column_data) if hasattr(row, 'column_data') else "{}", 
                    1 if getattr(row, 'is_synced', False) else 0
                )
                for row in rows
            ]
            cursor.executemany(
                "INSERT OR REPLACE INTO recipients (id, contract_id, nik, raw_data, balanced_data, is_balanced) VALUES (?, ?, ?, ?, ?, ?)",
                data
            )

    @staticmethod
    def save_batch_task(batch_id: str, nik: str, status: str, error: Optional[str] = None, idkontrak: Optional[str] = None):
        timestamp = datetime.now().isoformat()
        with db.get_cursor() as cursor:
            # Ensure idkontrak is preserved if already set for this batch
            if not idkontrak:
                cursor.execute("SELECT idkontrak FROM batch_tasks WHERE batch_id = ? LIMIT 1", (batch_id,))
                row = cursor.fetchone()
                if row:
                    idkontrak = row['idkontrak']

            cursor.execute("""
                INSERT INTO batch_tasks (batch_id, idkontrak, nik, status, error, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(batch_id, nik) DO UPDATE SET
                    status=excluded.status,
                    error=excluded.error,
                    timestamp=excluded.timestamp,
                    idkontrak=COALESCE(excluded.idkontrak, batch_tasks.idkontrak)
            """, (batch_id, idkontrak, nik, status, error, timestamp))

    @staticmethod
    def get_batch_summary(batch_id: str) -> Optional[BatchSummary]:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT * FROM batch_tasks WHERE batch_id = ?", (batch_id,))
            rows = cursor.fetchall()
            if not rows:
                return None
            
            tasks = []
            completed = 0
            failed = 0
            idkontrak = rows[0]['idkontrak'] or "UNKNOWN"
            
            for row in rows:
                tasks.append(BatchTaskStatus(
                    nik=row['nik'],
                    status=row['status'],
                    error=row['error'],
                    timestamp=row['timestamp']
                ))
                if row['status'] == 'SYNCED':
                    completed += 1
                elif row['status'] == 'FAILED':
                    failed += 1
            
            # Determine overall batch status
            total = len(rows)
            if completed + failed == total:
                status = "COMPLETED"
            elif any(r['status'] == 'PROCESSING' for r in rows):
                status = "PROCESSING"
            else:
                status = "PENDING"
            
            return BatchSummary(
                batch_id=batch_id,
                idkontrak=idkontrak,
                total=total,
                completed=completed,
                failed=failed,
                status=status,
                tasks=tasks
            )

    @staticmethod
    def master_search(query: str, contract_id: Optional[str] = None) -> List[dict]:
        """
        Elite Master Search: Scans NIK, Name, and Region using SQL LIKE.
        Optimized for 4GB RAM by limiting results.
        """
        sql = """
            SELECT * FROM recipients 
            WHERE (nik LIKE ? OR raw_data LIKE ?)
        """
        params = [f"%{query}%", f"%{query}%"]
        
        if contract_id:
            sql += " AND contract_id = ?"
            params.append(contract_id)
            
        sql += " LIMIT 100" # Pagination for RAM safety
        
        with db.get_cursor() as cursor:
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

vault_service = VaultService()
