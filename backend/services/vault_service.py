import json
from typing import List, Optional
from backend.db import db
from backend.models import PipelineRow, ReconciliationResult

class VaultService:
    @staticmethod
    def save_contract(id: str, name: str, target_value: float):
        with db.get_cursor() as cursor:
            cursor.execute(
                "INSERT OR REPLACE INTO contracts (id, name, target_value, status) VALUES (?, ?, ?, ?)",
                (id, name, target_value, "ACTIVE")
            )

    @staticmethod
    def save_recipients(contract_id: str, rows: List[PipelineRow]):
        with db.get_cursor() as cursor:
            # Efficient bulk insert
            data = [
                (
                    row.id, 
                    contract_id, 
                    row.nik, 
                    json.dumps(row.raw_values), 
                    json.dumps(row.balanced_values), 
                    1 if row.is_balanced else 0
                )
                for row in rows
            ]
            cursor.executemany(
                "INSERT OR REPLACE INTO recipients (id, contract_id, nik, raw_data, balanced_data, is_balanced) VALUES (?, ?, ?, ?, ?, ?)",
                data
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
