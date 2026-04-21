# [DATA-001] Polars Excel Ingestion & Logic
import polars as pl
import re
import os
import io
import uuid
import gc
from typing import List, Dict, Optional, Any, Tuple
from decimal import Decimal, ROUND_HALF_UP
from rapidfuzz import process, fuzz
import fastexcel
from backend.models import (
    ReconciliationResult, PipelineRow, LocationData, 
    FinancialData, ExcelIngestResult, ExcelSheetProbe, ExcelArchetype
)
from backend.services.diagnostics import diagnostics
from backend.services.location_service import location_service

# Smart Mapping from SmartBind11
HEADER_ALIAS_MAP = {
    "PROVINSI": ["provinsi", "p r o v", "prov", "insi"],
    "KABUPATEN": ["kabupaten", "kota", "k a b", "kab"],
    "KECAMATAN": ["kecamatan", "k e c", "kec"],
    "DESA/KEL": ["desa/kel", "kelurahan", "village", "desa", "kel"],
    "NIK": ["nik", "nomor induk kependudukan", "identity", "ktp", "no. ktp", "no ktp", "nomor", "id"],
    "NAMA PENERIMA": ["nama penerima", "nama petani", "ketua kelompok", "calon penerima", "nama ketua", "penerima", "petani", "penerima manfaat", "nama"],
    "QTY": ["volume barang", "volume", "kuantitas", "liter", "kg", "unit", "banyaknya", "jumlah volume", "pestisida", "qty"],
    "HARGA SATUAN": ["harga barang satuan", "harga satuan", "unit price", "harga barang", "satuan"],
    "ONGKOS KIRIM": ["ongkos kirim satuan", "ongkos kirim", "ongkir", "shipping", "biaya kirim", "jasa kirim"],
    "TOTAL_VALUE": ["jumlah total harga barang + jml total ongkir", "jumlah total harga", "total value", "nominal", "target", "pagu", "total bayar", "total nominal", "jumlah nominal"],
    "POKTAN/GROUP": ["kelompok tani", "gapoktan", "poktan", "group", "lmdh", "koperasi", "kth", "brigade"],
    "JADWAL": ["jadwal tanam", "masa tanam", "periode tanam", "jadwal", "periode"],
    "NO HP": ["whatsapp", "telepon", "kontak", "phone", "no hp", "no. hp"],
    "LUAS LAHAN": ["luas lahan", "land area", "jumlah luas", "ha"],
    "OPT DOMINAN": ["opt dominan", "opt", "hama", "pest", "kekurangan"],
    "SPESIFIKASI": ["spesifikasi", "merk", "produk", "specification", "brand"],
    "KETUA": ["ketua kelompok", "nama ketua", "ketua"],
    "NOMINAL BAST": ["nominal ditulis di bast", "ditulis di bast", "nominal bast", "jumlah nominal bast"],
    "LOKASI PERTANAMAN": ["lokasi pertanaman", "lokasi tanam", "pertanaman"],
    "SOURCE_IDX": ["ind", "index", "no.", "nomor", "no"],
}

def canonical_heal(header: Any) -> Tuple[Optional[str], int]:
    """Expert Extraction logic for Indonesian government headers. Returns (Canonical, Weight)"""
    if not header: return None, 0
    clean = str(header).lower().strip()
    
    # Filter common structural artifacts
    if "unnamed" in clean or clean.startswith("column_") or clean.startswith("_column_") or len(clean) < 2:
        return "UNNAMED", 0
    
    # Contextual Markers
    has_money = any(x in clean for x in ["harga", "nominal", "bayar", "rupiah", "rp", "bast", "duit"])
    has_volume = any(x in clean for x in ["kg", "liter", "volume", "unit", "qty", "banyak", "satuan"])
    has_ongkir = any(x in clean for x in ["ongkir", "kirim", "shipping", "transpor"])

    best_canonical = None
    best_match_len = 0
    
    # Precise Match using Alias Map (Weighted Strategy)
    for canonical, aliases in HEADER_ALIAS_MAP.items():
        for alias in aliases:
            # Word Boundary Hardening: Prevent 'nama' matching 'tanaman'
            # If alias is very short (< 5 chars), require word boundaries or exact match
            is_match = False
            if len(alias) <= 5:
                # Use regex for strict word boundaries
                if re.search(fr"\b{re.escape(alias)}\b", clean):
                    is_match = True
            elif alias in clean:
                is_match = True
                
            if is_match:
                weight = len(alias)
                # Exact match bonus
                if alias == clean: weight += 50
                
                # Boost weights based on context clues to avoid generic 'Jumlah' collisions
                if canonical == "TOTAL_VALUE" and has_money: weight += 10
                if canonical == "NOMINAL BAST" and "bast" in clean: weight += 20
                if canonical == "ONGKOS KIRIM" and has_ongkir: weight += 20
                if canonical == "QTY" and has_volume and not has_money: weight += 10
                
                if weight > best_match_len:
                    best_match_len = weight
                    best_canonical = canonical
            
    if best_canonical:
        # Special Case: If it's a generic 'Jumlah' but we detected it's likely Total
        final_canonical = best_canonical
        if best_canonical == "QTY" and has_money:
            final_canonical = "TOTAL_VALUE"
        return final_canonical, best_match_len
            
    # Fallback to Title Cased Raw if no match
    return None, 0

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

def make_unique(names: List[str]) -> List[str]:
    """Expert Guard: Ensure all column names are unique for polars compatibility."""
    seen = {}
    result = []
    for name in names:
        if not name: name = "unnamed"
        if name in seen:
            seen[name] += 1
            result.append(f"{name}_{seen[name]}")
        else:
            seen[name] = 0
            result.append(name)
    return result

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

class EliteJadwalHealer:
    """
    Expert-Grade Agrarian Date Resolver.
    Handles 'Okmar', 'Oct-Mar', 'April 2025', and 'Maret - April' with column-wide year baseline.
    """
    MONTH_MAP = {
        "jan": "Januari", "feb": "Februari", "mar": "Maret", "apr": "April",
        "mei": "Mei", "jun": "Juni", "jul": "Juli", "ags": "Agustus", "agt": "Agustus",
        "sep": "September", "okt": "Oktober", "nov": "November", "des": "Desember"
    }
    
    SHORTHAND_RANGES = {
        "okmar": ("Oktober", "Maret"),
        "ok - mar": ("Oktober", "Maret"),
        "asep": ("April", "September"),
        "aslab": ("April", "September"),
        "apr - sep": ("April", "September"),
        "okt-mar": ("Oktober", "Maret"),
        "apr-sep": ("April", "September")
    }

    def __init__(self, dominant_year: Optional[int] = None):
        self.dominant_year = str(dominant_year) if dominant_year else None

    def heal(self, val: Any) -> str:
        if not val or str(val).strip() in ["", "-", "—"]: return ""
        
        # Handle datetime objects directly from Excel parsers
        from datetime import datetime, date
        if isinstance(val, (datetime, date)):
            m_name = self.MONTH_MAP.get(val.strftime("%b").lower(), val.strftime("%B"))
            return f"{m_name} {val.year}"

        raw_s = str(val).strip()
        s = raw_s.lower()
        
        # 1. Quick Shorthand Aliases (Okmar, etc)
        for alias, (start, end) in self.SHORTHAND_RANGES.items():
            if alias in s:
                res = f"{start} - {end}"
                # If year is in original but not in our expansion, preserve it
                y_in_s = re.search(r'\d{4}', raw_s)
                if y_in_s:
                    res += f" {y_in_s.group()}"
                elif self.dominant_year:
                    res += f" {self.dominant_year}"
                return res

        # 2. Extract years already present
        found_years = re.findall(r'\d{4}', raw_s)
        year_to_append = self.dominant_year if not found_years else None
        
        # 3. Handle Month Ranges and Fragments
        # Split by common range delimiters
        parts = re.split(r'[-–/]', raw_s)
        healed_parts = []
        for p in parts:
            p_clean = p.strip()
            if not p_clean: continue
            
            p_low = p_clean.lower()
            p_year = re.search(r'\d{4}', p_clean)
            
            # Try to match month fragments or ISO month numbers
            matched_month = None
            for m_low, m_full in self.MONTH_MAP.items():
                if p_low.startswith(m_low):
                    matched_month = m_full
                    break
            
            # Additional check for ISO dates (2025-04-01)
            if not matched_month:
                iso_match = re.search(r'-(\d{2})-', p_clean)
                if iso_match:
                    m_idx = int(iso_match.group(1))
                    m_keys = sorted(self.MONTH_MAP.keys())
                    # Quick mapping for ISO indices if needed, but easier to use a static list
                    iso_months = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
                    if 1 <= m_idx <= 12:
                        matched_month = iso_months[m_idx]
            
            if matched_month:
                res_part = matched_month
                if p_year: res_part += f" {p_year.group()}"
                healed_parts.append(res_part)
            else:
                healed_parts.append(p_clean.title())

        # Join parts back together
        result = " - ".join([p for p in healed_parts if p])
        
        # 4. Final Year Cleanup & Appending
        if year_to_append and result and not re.search(r'\d{4}', result):
            result += f" {year_to_append}"
            
        return result.replace("  ", " ").strip()

def smart_detect_header(df: pl.DataFrame) -> Dict[str, Any]:
    """
    Expert Discovery Engine: detects if a file is LABELED or POSITIONAL.
    Uses multi-row target scoring to find the most 'header-dense' row.
    """
    keywords = [
        "nik", "nama", "penerima", "desa", "jumlah", "qty", "harga", "poktan", 
        "kecamatan", "ketua", "petani", "kabupaten", "provinsi", "pagu", "volume",
        "identitas", "ktp", "no.", "harga satuan", "jumlah total"
    ]
    max_scan = min(40, len(df))
    
    best_row_idx = -1
    max_matches = 0
    
    # 1. Identity Primary Header using MAX Keyword Density
    for i in range(max_scan):
        row_vals = [str(x).lower().strip() for x in df.row(i) if x is not None]
        match_count = sum(1 for k in keywords if any(k in v for v in row_vals))
        
        if match_count > max_matches:
            max_matches = match_count
            best_row_idx = i
            
    # 2. Archetype Fallback Logic
    # EXPERT RULE: If 'max_matches' is low (e.g. < 6) or we haven't found a 
    # high-confidence data grid, we MUST try the Bullseye (NIK) Scanner.
    archetype = ExcelArchetype.LABELED
    
    # We prefer the NIK Scanner if the labeled header is objectively weak
    if max_matches < 8:
        for i in range(max_scan):
            row_vals = [str(x) for x in df.row(i) if x is not None]
            # Sniff for NIK 
            for x in row_vals:
                if re.search(r'\d{12,16}', x) or re.search(r'\d\.\d{10,15}e\+\d{1,2}', x):
                    # We found actual DATA! Return the row ABOVE it as the header anchor.
                    archetype = ExcelArchetype.POSITIONAL
                    return {"index": i - 1, "row_indices": [], "archetype": archetype}

    # If still no header found and no NIKs, default to the BEST row found
    if best_row_idx == -1:
        best_row_idx = 0
        archetype = ExcelArchetype.UNKNOWN

    # 3. Enhanced Multi-Row Stapling (The Combine-Harvester logic)
    # Check if the row ABOVE or BELOW also contains keywords. 
    # Government headers are often 2-3 rows tall.
    row_indices = [best_row_idx]
    
    # Peek Up
    if best_row_idx > 0:
        up_row = [str(x).lower() for x in df.row(best_row_idx - 1) if x is not None]
        if sum(1 for k in keywords if any(k in v for v in up_row)) >= 2:
            row_indices.insert(0, best_row_idx - 1)
            
    # Peek Down
    if best_row_idx < (len(df) - 1):
        down_row = [str(x).lower() for x in df.row(best_row_idx + 1) if x is not None]
        if sum(1 for k in keywords if any(k in v for v in down_row)) >= 2:
            row_indices.append(best_row_idx + 1)
            
    return {"index": best_row_idx, "row_indices": row_indices, "archetype": archetype}

def is_pollution_row(row_dict: Dict[str, Any]) -> bool:
    """Surgical Anti-Pollution: Detect subtotal, total, and footnote rows."""
    pollution_keywords = ["total", "jumlah", "subtotal", "mengetahui", "nip", "lampiran", "ttd"]
    # We only check critical ID columns for pollution to avoid false positives in 'Notes' or 'OPT'
    for key in ["nik", "nama"]:
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
            sheet = excel_file.load_sheet(name, header_row=None)
            # Use small slice for probing to maximize speed
            df_probe = sheet.to_polars().head(30)
            
            row_count, col_count = df_probe.shape # This is just head, but fastexcel metadata might have full size
            # Get actual full shape if possible from fastexcel
            
            # Simple discovery score
            match_count = 0
            healed_headers = []
            
            if len(df_probe) > 0:
                header_meta = smart_detect_header(df_probe)
                header_idx = header_meta["index"]
                
                # Use df_probe (not df) and restore match logic
                row_vals = [str(x).lower().strip() for x in df_probe.row(header_idx)]
                raw_headers = [str(h).strip() for h in df_probe.row(header_idx) if h is not None]
                
                # Discovery logic
                match_count = sum(1 for k in keywords if any(k in v for v in row_vals))
                
                # Heal Headers for Discovery & Filter structural noise
                # canonical_heal now returns (Canonical, Weight)
                healed_headers = [canonical_heal(h)[0] for h in raw_headers]
                healed_headers = [h for h in healed_headers if h and h != "UNNAMED"]
            
            probes.append(ExcelSheetProbe(
                name=name,
                row_count=sheet.height, 
                col_count=sheet.width,  
                sample_rows=df_probe.head(5).to_dicts(),
                headers=healed_headers,
                discovery_score=min(1.0, match_count / 4.0)
            ))
        except Exception as e:
            print(f"Failed to probe sheet {name}: {e}")
            
    return probes

def ingest_excel_to_models(excel_content: bytes, target_sheet: Optional[str] = None) -> ExcelIngestResult:
    diagnostics.log_breadcrumb("EXCEL", f"Initializing Lead Ingestion{' on ' + target_sheet if target_sheet else ''}")
    
    try:
        excel_file = fastexcel.read_excel(excel_content)
        sheet_name = target_sheet or excel_file.sheet_names[0]
        sheet = excel_file.load_sheet(sheet_name, header_row=None)
        df_raw = sheet.to_polars()
        
        # 2. Expert Header Stapling
        header_meta = smart_detect_header(df_raw)
        header_idx = header_meta["index"]
        archetype = header_meta["archetype"]
        
        if archetype == ExcelArchetype.POSITIONAL:
            # Multi-Target Archetype B Layout:
            # [0:Prov, 1:Kab, 2:Kec, 3:Desa, 4:Poktan, 5:Ketua, 6:NIK, 7:Phone]
            unique_headers = [
                "provinsi", "kabupaten", "kecamatan", "desa", 
                "group", "nama", "nik", "phone"
            ]
            # Fill remaining columns with generic names
            for i in range(len(unique_headers), df_raw.width):
                unique_headers.append(f"col_{i}")
            
            df_data = df_raw
            df_data.columns = unique_headers
        else:
            # Build stapled headers if multiple rows found
            if len(header_meta["row_indices"]) > 1:
                rows_to_staple = [df_raw.row(idx) for idx in header_meta["row_indices"]]
                
                stapled = []
                for col_idx in range(df_raw.width):
                    col_vals = []
                    last_val = ""
                    for r_idx in range(len(rows_to_staple)):
                        val = deep_sanitize(rows_to_staple[r_idx][col_idx])
                        if val and val != last_val:
                            col_vals.append(val)
                            last_val = val
                    
                    # Join with underscore: "IDENTITY_NIK"
                    label = "_".join(col_vals)
                    stapled.append(label)
                
                clean_headers = [clean_header_text(h) for h in stapled]
            else:
                raw_header_row = df_raw.row(header_idx)
                clean_headers = [clean_header_text(x) for x in raw_header_row]
            
            unique_headers = make_unique(clean_headers)
            # Slice starts after the LAST header row
            last_header_row = header_meta["row_indices"][-1] if header_meta["row_indices"] else header_idx
            df_data = df_raw.slice(last_header_row + 1)
            df_data.columns = unique_headers

        diagnostics.log_breadcrumb("EXCEL", f"Detected {len(unique_headers)} columns (Archetype: {archetype.value})")
        # Log a snippet of the headers for cross-referencing
        diagnostics.log_breadcrumb("EXCEL", f"Headers: {', '.join(unique_headers[:5])}...")
        
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
            
        # PRODUCTION GUARD: Use high-tolerance schema inference for government sheets
        df_segmented = pl.from_dicts(final_rows, infer_schema_length=None)

        # 5. Production Processing Loop
        # [ELITE-MAPPING]: Instead of brittle renaming, we calculate which physical 
        # columns map to their 'Elite' categories (NIK, QTY, etc.)
        resolver = {}
        resolver_weights = {} # Tracking best matches
        header_map = {}
        header_meta = {} # NEW: Contextual Metadata (Healed -> Original)
        seen_count = {}
        
        # Phase 1: Determine the BEST physical columns for extraction identities
        # [ELITE-CONTENT-AWARE]: We apply a 'Data Quality Boost' to resolve ties.
        for h in unique_headers:
            canonical, weight = canonical_heal(h)
            if not canonical or canonical == "UNNAMED":
                continue
                
            # Fidelity Tie-Breaker for JADWAL
            if canonical == "JADWAL":
                try:
                    # Comprehensive month detection (Indonesian abbreviations + full names)
                    month_regex = r"(?i)jan|feb|mar|apr|mei|jun|jul|ags|agt|sep|okt|nov|des|uari|ruari|aret|ril|gustus|ptember|tober|vember|sember"
                    month_hits = df_data[h].head(50).cast(pl.Utf8).str.contains(month_regex).sum()
                    if month_hits > 0:
                        weight += 200 
                    
                    # Production Logging
                    diagnostics.log_breadcrumb("EXCEL-JADWAL-WEIGHT", f"Col: '{h}', MonthHits: {month_hits}, TotalWeight: {weight}")
                except Exception as e:
                    diagnostics.log_breadcrumb("EXCEL-JADWAL-ERROR", f"Content scan failed for '{h}': {e}")

            if canonical not in resolver or weight > resolver_weights.get(canonical, 0):
                resolver[canonical] = h
                resolver_weights[canonical] = weight
        
        # Phase 2: Build Header Map for UI & Storage
        # [GOLDEN-RESOLVER]: We ensure the 'Best' physical column for each category 
        # gets the CLEAN canonical name (e.g. 'JADWAL'). All others will be suffixed.
        
        # Step 1: Lock the winners
        for canonical, physical in resolver.items():
            header_map[physical] = canonical
            header_meta[canonical] = physical
            seen_count[canonical] = 0

        # Step 2: Handle the rest (Redundancies or Unmapped)
        for h in unique_headers:
            if h in header_map: continue # Winner already assigned
            
            canonical, weight = canonical_heal(h)
            
            # If it's a generic column that didn't match a canonical category
            if not canonical or canonical == "UNNAMED":
                clean = clean_header_text(h)
                canonical = clean.replace('_', ' ').upper()
            
            # Build unique names for redundant columns (e.g. JADWAL_1)
            if canonical in seen_count:
                seen_count[canonical] += 1
                healed = f"{canonical}_{seen_count[canonical]}"
            else:
                seen_count[canonical] = 0
                healed = canonical
            
            header_map[h] = healed
            header_meta[healed] = h
        
        # [ELITE-JADWAL-PRESCAN]: Analyze ALL columns identified as JADWAL for a year baseline.
        # This is critical because some sheets put '2025' in 'Masa Tanam' and 'April' in 'Jadwal Tanam'.
        dominant_year = None
        all_jadwal_physicals = [h for h in unique_headers if canonical_heal(h)[0] == "JADWAL"]
        
        if all_jadwal_physicals:
            try:
                # Collect 4-digit years from all potential schedule columns
                all_found_years = []
                for p_col in all_jadwal_physicals:
                    # Safely extract years using Polars string regex
                    y_series = df_segmented[p_col].cast(pl.Utf8).str.extract_all(r"(\d{4})").explode().drop_nulls()
                    if not y_series.is_empty():
                        all_found_years.append(y_series)
                
                if all_found_years:
                    combined_years = pl.concat(all_found_years)
                    if not combined_years.is_empty():
                        # value_counts() returns a DataFrame with columns [p_col_name, count]
                        counts = combined_years.value_counts(sort=True)
                        val_col = counts.columns[0]
                        
                        # Use .height for Polars DataFrame length
                        if counts.height == 1:
                            dominant_year = counts[0, val_col]
                        elif counts.height > 1:
                            total = counts["count"].sum()
                            if counts[0, "count"] / total > 0.9:
                                dominant_year = counts[0, val_col]
            except Exception as e:
                diagnostics.log_breadcrumb("EXCEL-JADWAL", f"Prescan failed: {e}")

        jadwal_healer = EliteJadwalHealer(dominant_year)
        
        # Log resolution status for auditability
        matches = [f"{k}->{v}" for k, v in resolver.items()]
        diagnostics.log_breadcrumb("EXCEL", f"Physical Resolvers: {', '.join(matches[:5])}...")

        rows: List[PipelineRow] = []
        total_target = Decimal('0')
        pollution_count = 0
        location_service.initialize()

        # Iterate over the original segmented data (Invariant Header Logic)
        for row_dict in df_segmented.to_dicts():
            # Drop purely empty or pollution rows
            if not any(v for v in row_dict.values() if v is not None):
                continue
                
            if is_pollution_row(row_dict):
                pollution_count += 1
                continue
            
            # ID Cleaning (Protect Trailing Digits)
            # Use Resolved Physical Keys instead of hardcoded categories
            raw_nik = protect_sci_notation(row_dict.get(resolver.get("NIK")))
            nik = normalize_nik(raw_nik)
            phone = normalize_phone(protect_sci_notation(row_dict.get(resolver.get("NO HP"))))
            
            name = str(row_dict.get(resolver.get("NAMA PENERIMA")) or "").strip()
            # A row needs at least a name or NIK to be valid
            if not nik and not name:
                # Log first 5 skips to see what we are missing
                if len(rows) < 1 and pollution_count < 10:
                    diagnostics.log_breadcrumb("EXCEL", f"Skipping row (Missing both NIK and Name map)")
                continue 

            # Financial Extraction (Comma/Period invariant)
            def to_dec(field_name):
                physical_col = resolver.get(field_name)
                v = row_dict.get(physical_col) if physical_col else None
                if v is None: return Decimal('0')
                try:
                    s = str(v).replace('Rp', '').replace(' ', '')
                    if ',' in s and '.' in s: s = s.replace('.', '').replace(',', '.')
                    elif ',' in s: s = s.replace(',', '.')
                    return Decimal(s).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
                except: return Decimal('0')

            qty = to_dec("QTY")
            price = to_dec("HARGA SATUAN")
            ship = to_dec("ONGKOS KIRIM")
            target = to_dec("TOTAL_VALUE")
            calc = (price + ship) * qty
            target_val = target
            
            # [PRODUCTION-RESOLUTION]: Resolve JADWAL with the column-wide baseline
            jadwal_col = resolver.get("JADWAL")
            raw_jadwal_val = row_dict.get(jadwal_col)
            healed_jadwal = jadwal_healer.heal(raw_jadwal_val)
            
            group = str(row_dict.get(resolver.get("POKTAN/GROUP")) or "").strip()
            
            calc_val = (price + ship) * qty
            gap = calc_val - target_val
            total_target += target_val

            # Elite Forensic Scrub Loop: 
            # Sanitize 100% of the columns to prevent 'broken data' (Unicode noise, Scientific notation)
            clean_row_dict = {}
            for k, v in row_dict.items():
                # Apply high-precision cleaning to every cell
                cleaned_val = deep_sanitize(v)
                
                # If it looks like NIK/Phone/Numeric, heal it from scientific notation
                if re.search(r'\d', cleaned_val):
                    cleaned_val = protect_sci_notation(cleaned_val)
                
                # [NIK-HARDENING] If this specific physical column was mapped to NIK, enforce digits-only
                if k == resolver.get("NIK"):
                    cleaned_val = normalize_nik(cleaned_val)
                    
                clean_row_dict[k] = cleaned_val

            # Regional Resolution
            raw_loc = {
                "provinsi": str(clean_row_dict.get(resolver.get("PROVINSI")) or ""),
                "kabupaten": str(clean_row_dict.get(resolver.get("KABUPATEN")) or ""),
                "kecamatan": str(clean_row_dict.get(resolver.get("KECAMATAN")) or ""),
                "desa": str(clean_row_dict.get(resolver.get("DESA/KEL")) or "")
            }
            repaired = location_service.resolve_location(**raw_loc)

            # [ELITE-SYNC]: Overwrite the broken regional data in clean_row_dict with repaired names 
            # so the UI table accurately shows the healed data (not just the 'An' or 'Antan' butchery).
            if repaired["provinsi"] and clean_row_dict.get(resolver.get("PROVINSI")):
                clean_row_dict[resolver.get("PROVINSI")] = repaired["provinsi"]
            if repaired["kabupaten"] and clean_row_dict.get(resolver.get("KABUPATEN")):
                clean_row_dict[resolver.get("KABUPATEN")] = repaired["kabupaten"]

            # [ELITE-AESTHETIC]: Ensure KETUA is title-cased specifically
            ketua_col = resolver.get("KETUA")
            if ketua_col and clean_row_dict.get(ketua_col):
                clean_row_dict[ketua_col] = str(clean_row_dict[ketua_col]).title()

            # [ELITE-JADWAL-SYNC]: Sync the healed jadwal back into all related columns
            # We sync to the primary JADWAL column AND any aliases (JADWAL_1, etc)
            for phys_col, healed_name in header_map.items():
                if healed_name.startswith("JADWAL"):
                    # Only heal the specific column if it's the primary one or contains year/month
                    h_val = clean_row_dict.get(phys_col)
                    if h_val:
                        clean_row_dict[phys_col] = jadwal_healer.heal(h_val)
            
            # Ensure the primary resolver column is definitely updated with the best healing
            if jadwal_col:
                clean_row_dict[jadwal_col] = healed_jadwal
            
            # [ELITE-COLLISION-GUARD]: If other columns also mapped to JADWAL (like JADWAL_1),
            # we should also heal them if they look like dates.
            for phys_col, healed_name in header_map.items():
                if healed_name.startswith("JADWAL") and phys_col != jadwal_col:
                    curr_val = clean_row_dict.get(phys_col)
                    if curr_val and any(m in str(curr_val).lower() for m in EliteJadwalHealer.MONTH_MAP.keys()):
                        clean_row_dict[phys_col] = jadwal_healer.heal(curr_val)

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
                is_synced=abs(gap) < Decimal('1.0'),
                # Forensic Alignment: ensure keys in column_data match the UI headers
                column_data={header_map[k]: v for k, v in clean_row_dict.items() if header_map.get(k) != "UNNAMED"},
                original_row={header_map[k]: v for k, v in clean_row_dict.items() if header_map.get(k) != "UNNAMED"},
                jadwal_tanam=healed_jadwal,
                group=group.title()
            )
            rows.append(p_row)

        gc.collect()
        diagnostics.log_success("EXCEL-ELITE-INGEST", f"Successfully parsed {len(rows)} verified recipient rows.")

        # Final Pass: Build UI Headers consistent with row data
        # [LEARN-020/DATA-020]: Ensure UI is clean and mapping is 1:1.
        final_ui_headers = []
        for h in unique_headers:
            col_name = header_map.get(h)
            if not col_name or col_name == "UNNAMED":
                continue
                
            # Filter out forced columns that are 'No Use'
            # (In this refined engine, we don't 'force' columns into the DF anymore, 
            # so we only check if they are empty in the segmented data)
            series = df_segmented[h]
            is_empty = series.is_null().all() or (series.dtype == pl.Utf8 and (series == "").all())
            is_synthetic = h.startswith("col_") or "unnamed" in h.lower()
            
            if is_empty and is_synthetic:
                continue
                
            final_ui_headers.append(col_name)

        return ExcelIngestResult(
            rows=rows,
            headers=final_ui_headers,
            sheet_name=sheet_name,
            total_target=float(total_target),
            header_index=header_idx,
            pollution_count=pollution_count,
            archetype=archetype,
            header_meta=header_meta
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
