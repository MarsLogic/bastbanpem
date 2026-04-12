import polars as pl
import re
import os
import io
import uuid
import gc
from typing import List, Dict, Optional, Any
from decimal import Decimal, ROUND_HALF_UP
from rapidfuzz import process, fuzz
import fastexcel
from backend.models import (
    ReconciliationResult, PipelineRow, LocationData, 
    FinancialData, ExcelIngestResult
)
from backend.services.diagnostics import diagnostics
from backend.services.location_service import location_service

# Smart Mapping from SmartBind11
HEADER_ALIAS_MAP = {
    "provinsi": ["prov", "insi", "provinsi"],
    "kabupaten": ["kab", "upaten", "kabupaten", "kota"],
    "kecamatan": ["kec", "amatan", "kecamatan"],
    "desa": ["desa", "kelurahan", "village"],
    "nik": ["nik", "nomor induk kependudukan", "id", "identity", "ktp"],
    "nama": ["nama", "ketua", "penerima", "petani", "penerima manfaat"],
    "qty": ["qty", "jumlah", "volume", "kuantitas", "liter", "kg"],
    "unit_price": ["harga", "satuan", "unit price"],
    "shipping": ["ongkir", "kirim", "shipping"],
    "target_value": ["target", "pagu", "jumlah total harga", "total value"],
    "group": ["kelompok", "poktan", "group"],
    "jadwal_tanam": ["tanam", "jadwal", "masa tanam", "periode"],
}

def protect_sci_notation(val: Any) -> str:
    """Elite Pattern: Prevent NIK corruption from Excel scientific notation."""
    s = str(val).strip()
    if not s or s.lower() == 'none' or s.lower() == 'nan': return ""
    
    if 'e' in s.lower() and '+' in s:
        try:
            parts = s.lower().split('e+')
            base = parts[0].replace('.', '')
            exponent = int(parts[1])
            decimal_parts = parts[0].split('.')
            decimal_count = len(decimal_parts[1]) if len(decimal_parts) > 1 else 0
            result = base + ('0' * (exponent - decimal_count))
            return result
        except: pass
    
    if '.' in s:
        parts = s.split('.')
        if len(parts) > 1 and (parts[1] == '0' or not parts[1]):
            return parts[0]
            
    return s

def normalize_nik(val: Any) -> str:
    if val is None: return ""
    digits = re.sub(r"\D", "", str(val))
    return digits if len(digits) == 16 else digits # Keep digits even if not 16, UI will flag

def normalize_jadwal_tanam(val: Any) -> str:
    if not val: return ""
    s = str(val).lower().strip()
    s = s.replace("okmar", "oktober-maret").replace("aslab", "april-september")
    # Title case for professionalism
    return s.title()

def smart_detect_header(df: pl.DataFrame) -> int:
    """Elite Heuristic: Finds header row by keyword density."""
    keywords = ["nik", "nama", "penerima", "desa", "jumlah", "qty", "harga"]
    max_scan = min(50, len(df))
    
    for i in range(max_scan):
        row_vals = [str(x).lower() for x in df.row(i) if x is not None]
        match_count = sum(1 for k in keywords if any(k in v for v in row_vals))
        if match_count >= 2:
            return i
    return 0

def smart_rename_columns(columns: List[str]) -> Dict[str, str]:
    rename_map = {}
    for col in columns:
        col_lower = col.lower().strip()
        for canonical, aliases in HEADER_ALIAS_MAP.items():
            if any(alias in col_lower for alias in aliases):
                rename_map[col] = canonical
                break
    return rename_map

def ingest_excel_to_models(excel_content: bytes) -> ExcelIngestResult:
    diagnostics.log_breadcrumb("EXCEL", "Starting Elite Ingestion Pipeline")
    
    try:
        excel_file = fastexcel.read_excel(excel_content)
        sheet_name = excel_file.sheet_names[0]
        df = excel_file.load_sheet(sheet_name).to_polars()
        
        # 1. Header Discovery
        header_idx = smart_detect_header(df)
        header_row = df.row(header_idx)
        raw_headers = [str(x) if x is not None else f"Unnamed_{i}" for i, x in enumerate(header_row)]
        
        # 2. Slice data and set columns
        df_data = df.slice(header_idx + 1)
        df_data.columns = raw_headers
        
        # 3. Forward Fill
        df_data = df_data.fill_null(strategy="forward")
        
        # 4. Smart Rename
        rename_map = smart_rename_columns(raw_headers)
        df_mapped = df_data.rename(rename_map)
        
        for col in ["nik", "nama", "qty", "unit_price", "shipping", "target_value"]:
            if col not in df_mapped.columns:
                df_mapped = df_mapped.with_columns(pl.lit(None).alias(col))

        # 5. Model Conversion & Cleaning
        rows: List[PipelineRow] = []
        total_target = Decimal('0')
        state = {"prov": "", "kab": "", "kec": "", "desa": "", "group": ""}

        # Initialize location service for repair
        location_service.initialize()

        for idx, row_dict in enumerate(df_mapped.to_dicts()):
            # Track location state
            for key in ["provinsi", "kabupaten", "kecamatan", "desa", "group"]:
                val = row_dict.get(key)
                if val: state[key[:4]] = str(val).strip()

            raw_nik = row_dict.get("nik")
            nik = normalize_nik(protect_sci_notation(raw_nik))
            
            name = str(row_dict.get("nama") or "").strip()
            if not nik and not name: continue 
            
            def to_dec(v):
                if v is None: return Decimal('0')
                try:
                    clean_v = re.sub(r'[^\d.,\-]', '', str(v)).replace(',', '.')
                    if not clean_v: return Decimal('0')
                    return Decimal(clean_v)
                except: return Decimal('0')

            qty = to_dec(row_dict.get("qty"))
            price = to_dec(row_dict.get("unit_price"))
            ship = to_dec(row_dict.get("shipping"))
            target = to_dec(row_dict.get("target_value"))
            
            calc = (price + ship) * qty
            gap = calc - target
            total_target += target

            # Elite Repair: Fix wrong parse location data
            raw_loc = {
                "provinsi": row_dict.get("provinsi") or state["prov"],
                "kabupaten": row_dict.get("kabupaten") or state["kab"],
                "kecamatan": row_dict.get("kecamatan") or state["kec"],
                "desa": row_dict.get("desa") or state["desa"]
            }
            repaired = location_service.resolve_location(**raw_loc)

            # Elite Row Construction
            p_row = PipelineRow(
                id=str(uuid.uuid4()),
                nik=nik,
                name=name,
                location=LocationData(
                    provinsi=raw_loc["provinsi"],
                    kabupaten=raw_loc["kabupaten"],
                    kecamatan=raw_loc["kecamatan"],
                    desa=raw_loc["desa"],
                    suggested_provinsi=repaired["provinsi"] if repaired["provinsi"] != raw_loc["provinsi"] else None,
                    suggested_kabupaten=repaired["kabupaten"] if repaired["kabupaten"] != raw_loc["kabupaten"] else None,
                    suggested_kecamatan=repaired["kecamatan"] if repaired["kecamatan"] != raw_loc["kecamatan"] else None,
                    suggested_desa=repaired["desa"] if repaired["desa"] != raw_loc["desa"] else None
                ),
                financials=FinancialData(
                    qty=float(qty),
                    unit_price=float(price),
                    shipping=float(ship),
                    target_value=float(target),
                    calculated_value=float(calc),
                    gap=float(gap)
                ),
                jadwal_tanam=normalize_jadwal_tanam(row_dict.get("jadwal_tanam")),
                group=str(row_dict.get("group") or state["grou"]),
                is_synced=abs(gap) < Decimal('1.0'),
                column_data=row_dict,
                original_row=row_dict
            )
            rows.append(p_row)

        # Explicit GC to free up fastexcel and polars objects
        gc.collect()

        return ExcelIngestResult(
            rows=rows,
            headers=raw_headers,
            sheet_name=sheet_name,
            total_target=float(total_target)
        )

    except Exception as e:
        diagnostics.log_error("EXCEL-ELITE-INGEST-FAIL", str(e))
        raise e

def apply_magic_balance(rows: List[PipelineRow], target_total: float) -> List[PipelineRow]:
    target_dec = Decimal(str(target_total))
    current_sum = sum([Decimal(str(r.financials.calculated_value)) for r in rows if not r.is_excluded])
    diff = target_dec - current_sum
    if diff == 0: return rows
    
    target_row = None
    max_val = Decimal('-1')
    for r in rows:
        if r.is_excluded or r.financials.qty <= 0: continue
        val = Decimal(str(r.financials.calculated_value))
        if val > max_val:
            max_val = val
            target_row = r
            
    if not target_row: return rows
    
    qty = Decimal(str(target_row.financials.qty))
    price = Decimal(str(target_row.financials.unit_price))
    old_ship = Decimal(str(target_row.financials.shipping))
    
    new_ship = old_ship + (diff / qty)
    new_calc = (price + new_ship) * qty
    
    target_row.financials.shipping = float(new_ship)
    target_row.financials.calculated_value = float(new_calc)
    target_row.financials.gap = float(new_calc - Decimal(str(target_row.financials.target_value)))
    target_row.is_synced = abs(Decimal(str(target_row.financials.gap))) < Decimal('1.0')
    return rows

def fuzzy_repair_nik(nik_list: List[str], target_niks: List[str], threshold=85) -> List[str]:
    repaired = []
    target_set = set(target_niks)
    for nik in nik_list:
        if not nik: 
            repaired.append("")
            continue
        if nik in target_set:
            repaired.append(nik)
            continue
        match = process.extractOne(nik, target_niks, scorer=fuzz.WRatio)
        if match and match[1] >= threshold:
            repaired.append(match[0])
        else:
            repaired.append(nik)
    return repaired

def reconcile_files(pdf_text: str, excel_content: bytes) -> ReconciliationResult:
    ingest_result = ingest_excel_to_models(excel_content)
    rows = ingest_result.rows
    pdf_niks = list(set(re.findall(r'\b\d{16}\b', pdf_text)))
    master_niks = [r.nik for r in rows if r.nik]
    repaired_pdf_niks = set(fuzzy_repair_nik(pdf_niks, master_niks))
    
    unmatched = []
    for r in rows:
        if r.nik in repaired_pdf_niks:
            r.is_synced = True 
        else:
            unmatched.append(r.nik)
            
    # Explicit GC
    gc.collect()
            
    return ReconciliationResult(
        rows=rows,
        total_count=len(rows),
        unmatched_niks=unmatched,
        is_fully_balanced=all([r.is_synced for r in rows]),
        discovered_headers=ingest_result.headers
    )
