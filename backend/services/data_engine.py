# [DATA-001] Polars Excel Ingestion & Logic
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

# # Smart Mapping from SmartBind11
HEADER_ALIAS_MAP = {
    "provinsi": ["prov", "insi", "provinsi"],
    "kabupaten": ["kab", "upaten", "kabupaten", "kota"],
    "kecamatan": ["kec", "amatan", "kecamatan"],
    "desa": ["desa", "kelurahan", "village"],
    "nik": ["nik", "nomor induk kependudukan", "id", "identity", "ktp"],
    "nama": ["nama", "ketua", "penerima", "petani", "penerima manfaat", "entity"],
    "qty": ["qty", "jumlah", "volume", "kuantitas", "liter", "kg", "pestisida"],
    "unit_price": ["harga", "satuan", "unit price", "harga barang satuan"],
    "shipping": ["ongkir", "kirim", "shipping", "ongkos kirim satuan"],
    "target_value": ["target", "pagu", "jumlah total harga", "total value", "jumlah nominal", "jumlah total harga barang + jml total ongkir"],
    "group": ["kelompok", "poktan", "group", "gapoktan", "lmdh", "koperasi", "kth", "bptph", "brigade"],
    "jadwal_tanam": ["tanam", "jadwal", "masa tanam", "periode"],
    "phone": ["no hp", "phone", "telepon", "kontak", "whatsapp"],
}

def deep_sanitize(val: Any) -> str:
    """Forensic Scrub: Remove all non-printable and invisible artifacts (\u200b, \r, \t, etc)."""
    if val is None: return ""
    s = str(val)
    # Remove control characters, zero-width spaces, and other invisible pollution
    s = "".join(ch for ch in s if ch.isprintable() or ch == '\n')
    # Collapse internal whitespace but preserve newlines for multi-line cells
    s = re.sub(r'[ \t\f\v]+', ' ', s)
    return s.strip()

def clean_header_text(text: Any) -> str:
    """Production Pattern: Sanitize headers from structural pollution (newlines, nulls, special chars)."""
    if text is None: return ""
    # Use deep_sanitize first
    s = deep_sanitize(text).lower()
    # Remove non-alphanumeric except underscore and space
    s = re.sub(r'[^\w\s/]', '', s)
    return re.sub(r'\s+', '_', s)

def protect_sci_notation(val: Any) -> str:
    """Elite Pattern: Prevent NIK corruption from Excel scientific notation."""
    s = str(val).strip()
    if not s or s.lower() in ('none', 'nan', ''): return ""
    
    # Handle scientific notation E+15
    if 'e' in s.lower() and '+' in s:
        try:
            return str(int(float(s)))
        except: pass
    
    # Remove trailing .0 from strings that should be integers
    if '.' in s:
        parts = s.split('.')
        if len(parts) > 1 and (parts[1] == '0' or not parts[1]):
            return parts[0]
            
    return s

def normalize_nik(val: Any) -> str:
    """Strict ID normalization."""
    if val is None: return ""
    # Strip all non-digits (newline artifacts, dashes)
    digits = re.sub(r"\D", "", str(val))
    return digits

def normalize_phone(val: Any) -> str:
    """Strict Phone normalization."""
    if val is None: return ""
    digits = re.sub(r"\D", "", str(val))
    if not digits: return ""
    # Handle cases where leading zero is missing in Excel
    if digits.startswith('8'):
        return '0' + digits
    return digits

def normalize_jadwal_tanam(val: Any) -> str:
    if not val: return ""
    s = str(val).lower().strip()
    s = s.replace("okmar", "oktober-maret").replace("aslab", "april-september")
    # Title case for professionalism
    return s.title()

def smart_detect_header(df: pl.DataFrame) -> Dict[str, Any]:
    """
    Expert Stapler: Find the primary header row and detect potential multi-row dependencies.
    Returns {index: int, row_indices: List[int]}
    """
    keywords = ["nik", "nama", "penerima", "desa", "jumlah", "qty", "harga", "poktan", "kecamatan"]
    max_scan = min(40, len(df))
    
    best_row_idx = 0
    max_matches = 0
    
    # 1. Identity Primary Header
    for i in range(max_scan):
        row_vals = [str(x).lower().strip() for x in df.row(i) if x is not None]
        match_count = sum(1 for k in keywords if any(k in v for v in row_vals))
        if match_count > max_matches:
            max_matches = match_count
            best_row_idx = i
            
    # 2. Check for Parent Header (The Stapler logic)
    # If the row above has sparse labels spanning multiple columns, it's a parent header.
    row_indices = [best_row_idx]
    if best_row_idx > 0:
        parent_row = df.row(best_row_idx - 1)
        # If parent row has significantly fewer non-null values than the child, it's a categorizer
        parent_non_null = sum(1 for x in parent_row if x is not None and str(x).strip())
        child_non_null = sum(1 for x in df.row(best_row_idx) if x is not None and str(x).strip())
        
        if 0 < parent_non_null < (child_non_null * 0.6):
            row_indices.insert(0, best_row_idx - 1)
            
    return {"index": best_row_idx, "row_indices": row_indices}

def is_pollution_row(row_dict: Dict[str, Any]) -> bool:
    """Anti-Pollution: Detect subtotal, total, and footnote rows."""
    pollution_keywords = ["total", "jumlah", "subtotal", "mengetahui", "nip", "lampiran", "ttd"]
    # Check key identification columns
    for key in ["kabupaten", "kecamatan", "nama", "nik"]:
        val = str(row_dict.get(key) or "").lower()
        if any(pk in val for pk in pollution_keywords):
            return True
    return False

def smart_rename_columns(columns: List[str]) -> Dict[str, str]:
    rename_map = {}
    for col in columns:
        col_lower = col.lower().strip()
        for canonical, aliases in HEADER_ALIAS_MAP.items():
            if any(alias in col_lower for alias in aliases):
                rename_map[col] = canonical
                break
    return rename_map

def probe_excel_structure(excel_content: bytes) -> List[ExcelSheetProbe]:
    """Expert Phase 1: Probe workbook for structural discovery."""
    excel_file = fastexcel.read_excel(excel_content)
    probes: List[ExcelSheetProbe] = []
    
    keywords = ["nik", "nama", "penerima", "desa", "jumlah", "qty", "harga"]
    
    for name in excel_file.sheet_names:
        try:
            sheet = excel_file.load_sheet(name)
            # Use small slice for probing to maximize speed
            df_probe = sheet.to_polars().head(20)
            
            row_count, col_count = df_probe.shape # This is just head, but fastexcel metadata might have full size
            # Get actual full shape if possible from fastexcel
            
            # Simple discovery score
            match_count = 0
            headers = []
            if len(df_probe) > 0:
                header_idx = smart_detect_header(df_probe)
                raw_headers = df_probe.row(header_idx)
                headers = [str(h) for h in raw_headers if h is not None]
                row_vals = [str(x).lower() for x in raw_headers if x is not None]
                match_count = sum(1 for k in keywords if any(k in v for v in row_vals))
            
            probes.append(ExcelSheetProbe(
                name=name,
                row_count=sheet.height, # Actual sheet height
                col_count=sheet.width,  # Actual sheet width
                sample_rows=df_probe.head(5).to_dicts(),
                headers=headers,
                discovery_score=min(1.0, match_count / 4.0)
            ))
        except Exception as e:
            print(f"Failed to probe sheet {name}: {e}")
            
    return probes

def ingest_excel_to_models(excel_content: bytes, target_sheet: Optional[str] = None) -> ExcelIngestResult:
    diagnostics.log_breadcrumb("EXCEL", f"Initializing Maximum Expert Pipeline{' on ' + target_sheet if target_sheet else ''}")
    
    try:
        # PRODUCTION SCALE: Use polars for everything to maintain data purity
        excel_file = fastexcel.read_excel(excel_content)
        sheet_name = target_sheet or excel_file.sheet_names[0]
        sheet = excel_file.load_sheet(sheet_name)
        df_raw = sheet.to_polars()
        
        # 2. Expert Header Stapling
        header_meta = smart_detect_header(df_raw)
        header_idx = header_meta["index"]
        
        # Build stapled headers if multiple rows found
        if len(header_meta["row_indices"]) > 1:
            p_row = df_raw.row(header_meta["row_indices"][0])
            c_row = df_raw.row(header_meta["row_indices"][1])
            
            stapled = []
            last_parent = ""
            for p, c in zip(p_row, c_row):
                p_val = deep_sanitize(p)
                if p_val: last_parent = p_val
                
                c_val = deep_sanitize(c)
                if last_parent and c_val and last_parent.lower() not in c_val.lower():
                    stapled.append(f"{last_parent}_{c_val}")
                else:
                    stapled.append(c_val or last_parent)
            clean_headers = [clean_header_text(h) for h in stapled]
        else:
            raw_header_row = df_raw.row(header_idx)
            clean_headers = [clean_header_text(x) if x is not None else f"unnamed_{i}" for i, x in enumerate(raw_header_row)]
            
        # Reload with corrected offset and clean headers
        df_data = df_raw.slice(header_idx + 1)
        df_data.columns = [h if h else f"col_{i}" for i, h in enumerate(clean_headers)]
        
        # 3. BOUNDED FORWARD FILL (Segmented)
        # Detect table breakers (large null gaps) to prevent data bleed
        regional_cols = [c for c in df_data.columns if any(x in c.lower() for x in ["insi", "kabupaten", "kecamatan", "desa"])]
        
        # We process row by row for the forward fill to detect "Gap Breakers"
        final_rows = []
        last_regionals = {c: None for c in regional_cols}
        consecutive_nulls = 0
        
        for row_dict in df_data.to_dicts():
            is_empty = not any(v for v in row_dict.values() if v is not None and str(v).strip())
            
            if is_empty:
                consecutive_nulls += 1
                if consecutive_nulls >= 3: # Table Segment Breaker
                    last_regionals = {c: None for c in regional_cols}
                continue
            
            consecutive_nulls = 0
            
            # Apply Bounded Forward-Fill
            for col in regional_cols:
                val = row_dict.get(col)
                if val is not None and str(val).strip():
                    last_regionals[col] = val
                else:
                    row_dict[col] = last_regionals[col]
            
            final_rows.append(row_dict)
            
        df_segmented = pl.DataFrame(final_rows)

        # 4. Canonical Mapping
        rename_map = {}
        for col in df_segmented.columns:
            col_key = col.lower()
            for canonical, aliases in HEADER_ALIAS_MAP.items():
                if any(alias in col_key for alias in aliases):
                    rename_map[col] = canonical
                    break
        
        df_mapped = df_segmented.rename(rename_map)
        
        # Ensure core columns exist
        for col in ["nik", "nama", "qty", "unit_price", "shipping", "target_value", "phone", "group"]:
            if col not in df_mapped.columns:
                df_mapped = df_mapped.with_columns(pl.lit(None).alias(col))

        # 5. Production Processing Loop
        rows: List[PipelineRow] = []
        total_target = Decimal('0')
        pollution_count = 0
        location_service.initialize()

        for row_dict in df_mapped.to_dicts():
            # Drop purely empty or pollution rows
            if not any(v for v in row_dict.values() if v is not None):
                continue
                
            if is_pollution_row(row_dict):
                pollution_count += 1
                continue
            
            # ID Cleaning (Protect Trailing Digits)
            raw_nik = protect_sci_notation(row_dict.get("nik"))
            nik = normalize_nik(raw_nik)
            phone = normalize_phone(protect_sci_notation(row_dict.get("phone")))
            
            name = str(row_dict.get("nama") or "").strip()
            # A row needs at least a name or NIK to be valid
            if not nik and not name: continue 

            # Financial Extraction (Comma/Period invariant)
            def to_dec(v):
                if v is None: return Decimal('0')
                try:
                    # Strip currency symbols and handle Indonesian formatting (dot for thousands, comma for decimal)
                    s = str(v).replace('Rp', '').replace(' ', '')
                    if ',' in s and '.' in s: # Mixed format
                        s = s.replace('.', '').replace(',', '.')
                    elif ',' in s: # Likely Indonesian decimal
                        s = s.replace(',', '.')
                    return Decimal(s).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
                except: return Decimal('0')

            qty = to_dec(row_dict.get("qty"))
            price = to_dec(row_dict.get("unit_price"))
            ship = to_dec(row_dict.get("shipping"))
            # Note: User's file has 'Jumlah total Harga Barang + Jml total Ongkir' as the primary target
            target = to_dec(row_dict.get("target_value"))
            
            calc = (price + ship) * qty
            gap = calc - target
            total_target += target

            # Regional Resolution
            raw_loc = {
                "provinsi": str(row_dict.get("provinsi") or ""),
                "kabupaten": str(row_dict.get("kabupaten") or ""),
                "kecamatan": str(row_dict.get("kecamatan") or ""),
                "desa": str(row_dict.get("desa") or "")
            }
            repaired = location_service.resolve_location(**raw_loc)

            # Elite Row Instantiation
            p_row = PipelineRow(
                id=str(uuid.uuid4()),
                nik=nik,
                name=name.title(), # Elite Aesthetic
                phone=phone,
                location=LocationData(
                    provinsi=raw_loc["provinsi"],
                    kabupaten=raw_loc["kabupaten"],
                    kecamatan=raw_loc["kecamatan"],
                    desa=raw_loc["desa"],
                    suggested_provinsi=repaired["provinsi"] if repaired["provinsi"].lower() != raw_loc["provinsi"].lower() else None,
                    suggested_kabupaten=repaired["kabupaten"] if repaired["kabupaten"].lower() != raw_loc["kabupaten"].lower() else None,
                    suggested_kecamatan=repaired["kecamatan"] if repaired["kecamatan"].lower() != raw_loc["kecamatan"].lower() else None,
                    suggested_desa=repaired["desa"] if repaired["desa"].lower() != raw_loc["desa"].lower() else None
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
                group=str(row_dict.get("group") or "").title(),
                is_synced=abs(gap) < Decimal('1.0'),
                column_data=row_dict,
                original_row=row_dict
            )
            rows.append(p_row)

        gc.collect()
        diagnostics.log_success("EXCEL-ELITE-INGEST", f"Successfully parsed {len(rows)} verified recipient rows.")

        return ExcelIngestResult(
            rows=rows,
            headers=clean_headers,
            sheet_name=sheet_name,
            total_target=float(total_target),
            header_index=header_idx,
            pollution_count=pollution_count
        )

    except Exception as e:
        diagnostics.log_error("EXCEL-ELITE-INGEST-FAIL", str(e))
        raise e

def apply_magic_balance(rows: List[PipelineRow], target_total: float) -> List[PipelineRow]:
    """
    Expert Proportional Balancing Engine.
    Distributes the contract value delta across all recipients proportionally
    based on their quantity, ensuring high-integrity rounding.
    """
    target_dec = Decimal(str(target_total))
    
    # 1. Identify active rows for balancing
    active_rows = [r for r in rows if not r.is_excluded and r.financials.qty > 0]
    if not active_rows: return rows
    
    # 2. Calculate current sum and total quantity
    current_sum = sum([Decimal(str(r.financials.calculated_value)) for r in active_rows])
    total_qty = sum([Decimal(str(r.financials.qty)) for r in active_rows])
    
    delta = target_dec - current_sum
    if delta == 0: return rows
    
    # 3. Proportional Distribution
    # Formula: new_shipping = old_shipping + (delta / total_qty)
    # This ensures the delta is perfectly absorbed across all rows weighted by Qty.
    adjustment_per_unit = delta / total_qty
    
    for r in active_rows:
        qty = Decimal(str(r.financials.qty))
        price = Decimal(str(r.financials.unit_price))
        old_ship = Decimal(str(r.financials.shipping))
        
        # Calculate new values
        new_ship = (old_ship + adjustment_per_unit).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        new_calc = (price + new_ship) * qty
        
        # Update row
        r.financials.shipping = float(new_ship)
        r.financials.calculated_value = float(new_calc)
        r.financials.gap = float(new_calc - Decimal(str(r.financials.target_value)))
        r.is_synced = abs(Decimal(str(r.financials.gap))) < Decimal('1.0')
        
    # 4. Final Cleanup: Check for micro-rounding residual
    final_sum = sum([Decimal(str(r.financials.calculated_value)) for r in active_rows])
    residual = target_dec - final_sum
    
    if residual != 0 and active_rows:
        # Dump any remaining cents into the largest row to ensure 100% target match
        largest = max(active_rows, key=lambda x: x.financials.qty)
        qty_l = Decimal(str(largest.financials.qty))
        largest.financials.shipping = float(Decimal(str(largest.financials.shipping)) + (residual / qty_l))
        largest.financials.calculated_value = float((Decimal(str(largest.financials.unit_price)) + Decimal(str(largest.financials.shipping))) * qty_l)
        
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
