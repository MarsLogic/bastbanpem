import sqlite3
import os
import json
import shutil
from contextlib import contextmanager

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_DIR = os.path.join(_BASE_DIR, "App_Data")
os.makedirs(_DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(_DATA_DIR, "bastbanpem_vault.db")

# Migrate legacy DB from project root to App_Data on first startup
_legacy_path = os.path.join(_BASE_DIR, "bastbanpem_vault.db")
if os.path.exists(_legacy_path) and not os.path.exists(DB_PATH):
    try:
        shutil.move(_legacy_path, DB_PATH)
    except PermissionError:
        # File is locked (backend still running) — copy instead, cleanup next restart
        shutil.copy2(_legacy_path, DB_PATH)

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
