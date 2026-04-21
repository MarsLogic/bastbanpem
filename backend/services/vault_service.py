# [DATA-003] SQLite Contract Storage
import json
from typing import List, Optional
from datetime import datetime
from backend.db import db
from backend.models import PipelineRow, ReconciliationResult, BatchTaskStatus, BatchSummary, ContractMetadata

class VaultService:
    def __init__(self):
        self._init_batch_table()
        self._init_alignment_table()

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
    def _init_alignment_table():
        with db.get_cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS alignment_jobs (
                    job_id TEXT PRIMARY KEY,
                    contract_id TEXT,
                    status TEXT, -- PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
                    progress INTEGER DEFAULT 0,
                    total INTEGER DEFAULT 0,
                    error TEXT,
                    result_json TEXT,
                    last_heartbeat TEXT,
                    created_at TEXT
                )
            """)

    @staticmethod
    def save_contract(
        id: str,
        name: str,
        target_value: float,
        metadata: Optional[ContractMetadata] = None,
        ultra_robust: Optional[dict] = None,
        tables: Optional[list] = None,
        rows: Optional[List[PipelineRow]] = None,
    ):
        meta_json   = metadata.model_dump_json() if metadata else "{}"
        
        if hasattr(ultra_robust, 'model_dump_json'):
            ultra_json = ultra_robust.model_dump_json()
        elif hasattr(ultra_robust, 'json'):
            ultra_json = ultra_robust.json()
        else:
            ultra_json = json.dumps(ultra_robust, ensure_ascii=False) if ultra_robust is not None else None
            
        tables_json = json.dumps(tables, ensure_ascii=False) if tables is not None else None
        
        with db.get_cursor() as cursor:
            cursor.execute(
                """INSERT OR REPLACE INTO contracts
                   (id, name, target_value, status, metadata, ultra_robust_json, tables_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (id, name, target_value, "ACTIVE", meta_json, ultra_json, tables_json),
            )
        
        # --- Handle Recipients [EXPERT-004] ---
        if rows:
            VaultService.save_recipients(id, rows)

    @staticmethod
    def get_contract(id: str) -> Optional[dict]:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT * FROM contracts WHERE id = ?", (id,))
            row = cursor.fetchone()
            if not row:
                return None
            result = dict(row)

            # --- Recipient Recovery [EXPERT-004] ---
            cursor.execute("""
                SELECT raw_data, balanced_data, is_balanced 
                FROM recipients 
                WHERE contract_id = ?
            """, (id,))
            recipient_rows = cursor.fetchall()
            
            recipients = []
            for r_row in recipient_rows:
                try:
                    # Merge data for full PipelineRow reconstruction
                    raw = json.loads(r_row['raw_data'])
                    balanced = json.loads(r_row['balanced_data'])
                    # If balanced data exists and has the full structure, use it
                    # otherwise fallback to raw plus basic fields
                    recipients.append({
                        **raw,
                        **balanced,
                        "is_synced": bool(r_row['is_balanced'])
                    })
                except Exception:
                    continue
            result["recipients"] = recipients

            # Parse ultra_robust JSON column
            ultra_raw = result.pop("ultra_robust_json", None)
            result["ultra_robust"] = None
            if ultra_raw:
                try:
                    result["ultra_robust"] = json.loads(ultra_raw)
                except Exception:
                    pass

            # Parse tables JSON column
            tables_raw = result.pop("tables_json", None)
            result["tables"] = []
            if tables_raw:
                try:
                    result["tables"] = json.loads(tables_raw)
                except Exception:
                    pass

            return result

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

    @staticmethod
    def save_alignment_job(job_id: str, contract_id: str, status: str, total: int = 0):
        timestamp = datetime.now().isoformat()
        with db.get_cursor() as cursor:
            cursor.execute("""
                INSERT OR REPLACE INTO alignment_jobs (job_id, contract_id, status, total, progress, last_heartbeat, created_at)
                VALUES (?, ?, ?, ?, 0, ?, ?)
            """, (job_id, contract_id, status, total, timestamp, timestamp))

    @staticmethod
    def update_alignment_progress(job_id: str, progress: int, status: str = "RUNNING", result_json: Optional[str] = None, error: Optional[str] = None):
        timestamp = datetime.now().isoformat()
        with db.get_cursor() as cursor:
            if result_json:
                cursor.execute("""
                    UPDATE alignment_jobs 
                    SET progress = ?, status = ?, result_json = ?, last_heartbeat = ?
                    WHERE job_id = ?
                """, (progress, status, result_json, timestamp, job_id))
            elif error:
                cursor.execute("""
                    UPDATE alignment_jobs 
                    SET status = "FAILED", error = ?, last_heartbeat = ?
                    WHERE job_id = ?
                """, (error, timestamp, job_id))
            else:
                cursor.execute("""
                    UPDATE alignment_jobs 
                    SET progress = ?, status = ?, last_heartbeat = ?
                    WHERE job_id = ?
                """, (progress, status, timestamp, job_id))

    @staticmethod
    def get_alignment_job(job_id: str) -> Optional[dict]:
        with db.get_cursor() as cursor:
            cursor.execute("SELECT * FROM alignment_jobs WHERE job_id = ?", (job_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_latest_job_for_contract(contract_id: str) -> Optional[dict]:
        with db.get_cursor() as cursor:
            cursor.execute("""
                SELECT * FROM alignment_jobs 
                WHERE contract_id = ? AND status IN ("PENDING", "RUNNING")
                ORDER BY created_at DESC LIMIT 1
            """, (contract_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

vault_service = VaultService()
