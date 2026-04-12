import sqlite3
import os
import json
from contextlib import contextmanager

DB_PATH = "bastbanpem_vault.db"

class Database:
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()
        
    def _init_schema(self):
        # Enable WAL for 4GB RAM performance
        self.conn.execute("PRAGMA journal_mode=WAL")
        
        # Contract Table
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS contracts (
                id TEXT PRIMARY KEY,
                name TEXT,
                target_value REAL,
                status TEXT,
                metadata TEXT
            )
        """)
        
        # Recipients Table (Elite Lineage)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS recipients (
                id TEXT PRIMARY KEY,
                contract_id TEXT,
                nik TEXT,
                raw_data TEXT,
                balanced_data TEXT,
                is_balanced INTEGER DEFAULT 0,
                FOREIGN KEY(contract_id) REFERENCES contracts(id)
            )
        """)
        self.conn.commit()

    @contextmanager
    def get_cursor(self):
        cursor = self.conn.cursor()
        try:
            yield cursor
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise e

db = Database()
