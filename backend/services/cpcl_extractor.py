# [DOCS-003] Expert CPCL PDF Extraction Engine
import fitz  # PyMuPDF
import re
import json
import os
from typing import List, Dict, Any
from rapidfuzz import process, fuzz
from backend.models import PipelineRow
from backend.services.location_service import location_service

class CpclIntelligence:
    """
    Expert Engine to extract structured CPCL data from SK PDFs.
    Designed to handle varying government table formats.
    """
    
    # Common headers in SK CPCL PDFs
    COLUMN_ANCHORS = {
        "nik": ["NIK", "NOMOR INDUK", "N1K"],
        "nama": ["NAMA", "PENERIMA", "PENER1MA"],
        "gapoktan": ["KELOMPOK", "GAPOKTAN", "POKTAN"],
        "qty": ["VOLUME", "QTY", "JUMLAH", "JUML4H"],
        "nilai": ["NILAI", "PAGU", "TOTAL", "HARGA"]
    }

    @classmethod
    def extract_from_pdf(cls, pdf_path: str) -> List[Dict[str, Any]]:
        doc = fitz.open(pdf_path)
        extracted_data = []
        
        for page in doc:
            # 1. Get structured text blocks with coordinates
            blocks = page.get_text("dict")["blocks"]
            
            # 2. Identify Table Header Row (Spatial Analysis)
            # We look for a horizontal line of text containing NIK or NAMA
            header_y = None
            col_map = {} # label -> x_coordinate
            
            for b in blocks:
                if "lines" not in b: continue
                for line in b["lines"]:
                    for span in line["spans"]:
                        text = span["text"].upper().strip()
                        for key, anchors in cls.COLUMN_ANCHORS.items():
                            if any(a in text for a in anchors):
                                col_map[key] = span["bbox"][0] # Use left X
                                header_y = span["bbox"][1] # Capture Y
            
            if not col_map or header_y is None:
                continue # No table found on this page

            # 3. Extract Data Rows below Header
            # We group text spans into rows based on Y-coordinate proximity
            rows = {}
            for b in blocks:
                if "lines" not in b: continue
                for line in b["lines"]:
                    for span in line["spans"]:
                        y = round(span["bbox"][1])
                        if y > header_y + 10: # Only look below header
                            if y not in rows: rows[y] = []
                            rows[y].append(span)

            # 4. Map Spans to Columns by X-coordinate
            for y in sorted(rows.keys()):
                row_spans = rows[y]
                entry = {}
                for key, target_x in col_map.items():
                    # Find span closest to the column X-header
                    closest_span = min(row_spans, key=lambda s: abs(s["bbox"][0] - target_x))
                    # Check if it's actually within a reasonable horizontal distance
                    if abs(closest_span["bbox"][0] - target_x) < 100:
                        entry[key] = closest_span["text"].strip()
                
                if entry.get("nik") and entry.get("nama"):
                    # Validate NIK
                    clean_nik = "".join(filter(str.isdigit, entry["nik"]))
                    if len(clean_nik) >= 15:
                        entry["nik"] = clean_nik[:16]
                        extracted_data.append(entry)

        return extracted_data

    @classmethod
    def reconcile_to_portal_schema(cls, raw_entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Maps raw PDF extraction to the Government Portal's Excel format.
        """
        final_rows = []
        for entry in raw_entries:
            # Map to Portal Headers: No, Penerima, Titik Bagi, Gapoktan, Barang, Qty, Nilai
            final_rows.append({
                "Penerima": f"{entry['nik']}\n{entry['nama']}",
                "Gapoktan": entry.get("gapoktan", ""),
                "Qty": entry.get("qty", "0").replace(",", "."),
                "Nilai": entry.get("nilai", "0").replace(".", "").replace(",", "."),
                # Titik Bagi usually needs manual/location resolution
                "Titik Bagi": "AUTO-RESOLVE-PENDING" 
            })
        return final_rows

# Example usage pattern for the vendor app
def process_vendor_pdfs(folder_path: str):
    all_data = []
    for file in os.listdir(folder_path):
        if file.endswith(".pdf"):
            path = os.path.join(folder_path, file)
            print(f"Analyzing {file}...")
            data = CpclIntelligence.extract_from_pdf(path)
            all_data.extend(data)
    
    # Map to Portal Excel Schema
    portal_ready_data = CpclIntelligence.reconcile_to_portal_schema(all_data)
    return portal_ready_data
