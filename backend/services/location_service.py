# [DATA-002] Master Location Resolver
import json
import os
import polars as pl
from typing import List, Dict, Optional, Any
from rapidfuzz import process, fuzz
from backend.services.diagnostics import diagnostics

class EliteLocationService:
    _instance = None
    _df = None
    _is_loaded = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EliteLocationService, cls).__new__(cls)
        return cls._instance

    def initialize(self):
        """
        Elite Loading Pattern: Loads 8.8MB JSON into Polars for RAM-efficient Probing.
        """
        if self._is_loaded:
            return

        base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        json_path = os.path.join(base_path, "public", "master_locations.json")

        if not os.path.exists(json_path):
            diagnostics.log_error("LOC-MISSING", f"Master locations file not found at {json_path}")
            return

        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Load into Polars for fast filtering and column operations
            self._df = pl.DataFrame(data)
            
            # Create a combined search column for rapid broad probing
            self._df = self._df.with_columns([
                (pl.col("provinsi") + " " + pl.col("kabupaten") + " " + pl.col("kecamatan") + " " + pl.col("desa")).str.to_lowercase().alias("search_blob")
            ])
            
            self._is_loaded = True
            diagnostics.log_breadcrumb("LOCATION", f"Loaded {len(self._df)} master locations into memory.")
        except Exception as e:
            diagnostics.log_error("LOC-LOAD-FAIL", str(e))

    def resolve_location(self, 
                         provinsi: str = "", 
                         kabupaten: str = "", 
                         kecamatan: str = "", 
                         desa: str = "") -> Dict[str, str]:
        """
        Elite Repair Logic: Fixes messy Excel location data using master registry.
        """
        if not self._is_loaded:
            self.initialize()
        
        if self._df is None:
            return {"provinsi": provinsi, "kabupaten": kabupaten, "kecamatan": kecamatan, "desa": desa}

        # 1. Broad Probing
        # If we have a very specific desa, we try to find it first.
        search_q = f"{provinsi} {kabupaten} {kecamatan} {desa}".lower().strip()
        if not search_q:
            return {"provinsi": provinsi, "kabupaten": kabupaten, "kecamatan": kecamatan, "desa": desa}

        # Optimization: Exact match check on tokens
        tokens = [t for t in search_q.split() if len(t) >= 3]
        if not tokens:
            return {"provinsi": provinsi, "kabupaten": kabupaten, "kecamatan": kecamatan, "desa": desa}

        # Filter candidates that contain at least one token (to reduce fuzzy space)
        # Using Polars for rapid reduction
        predicate = pl.lit(False)
        for t in tokens:
            predicate = predicate | pl.col("search_blob").str.contains(t)
        
        candidates = self._df.filter(predicate)
        
        if len(candidates) == 0:
            # Try even more aggressive contains if nothing found
            return {"provinsi": provinsi, "kabupaten": kabupaten, "kecamatan": kecamatan, "desa": desa}

        # 2. Fuzzy Scoring
        # We use RapidFuzz on the search_blob of the reduced candidate set
        blob_list = candidates["search_blob"].to_list()
        match_result = process.extractOne(search_q, blob_list, scorer=fuzz.WRatio)
        
        if match_result and match_result[1] >= 75:
            matched_idx = match_result[2]
            row = candidates.row(matched_idx)
            # Row structure: provinsi, kabupaten, kecamatan, desa, search_blob
            return {
                "provinsi": row[0],
                "kabupaten": row[1],
                "kecamatan": row[2],
                "desa": row[3]
            }

        return {"provinsi": provinsi, "kabupaten": kabupaten, "kecamatan": kecamatan, "desa": desa}

# Global Singleton
location_service = EliteLocationService()
