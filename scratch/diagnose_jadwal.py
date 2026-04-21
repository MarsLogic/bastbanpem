import polars as pl
import fastexcel
import re
from typing import Any, Optional, Tuple

# Paste the logic from data_engine.py to test it locally
HEADER_ALIAS_MAP = {
    "JADWAL": ["jadwal tanam", "masa tanam", "periode tanam", "jadwal", "periode"],
}

class EliteJadwalHealer:
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
        from datetime import datetime, date
        if isinstance(val, (datetime, date)):
            m_name = self.MONTH_MAP.get(val.strftime("%b").lower(), val.strftime("%B"))
            return f"{m_name} {val.year}"

        raw_s = str(val).strip()
        s = raw_s.lower()
        for alias, (start, end) in self.SHORTHAND_RANGES.items():
            if alias in s:
                res = f"{start} - {end}"
                y_in_s = re.search(r'\d{4}', raw_s)
                if y_in_s: res += f" {y_in_s.group()}"
                elif self.dominant_year: res += f" {self.dominant_year}"
                return res

        found_years = re.findall(r'\d{4}', raw_s)
        year_to_append = self.dominant_year if not found_years else None
        parts = re.split(r'[-–/]', raw_s)
        healed_parts = []
        for p in parts:
            p_clean = p.strip()
            if not p_clean: continue
            p_low = p_clean.lower()
            p_year = re.search(r'\d{4}', p_clean)
            matched_month = None
            for m_low, m_full in self.MONTH_MAP.items():
                if p_low.startswith(m_low):
                    matched_month = m_full
                    break
            if matched_month:
                res_part = matched_month
                if p_year: res_part += f" {p_year.group()}"
                healed_parts.append(res_part)
            else:
                healed_parts.append(p_clean.title())

        result = " - ".join([p for p in healed_parts if p])
        if year_to_append and result and not re.search(r'\d{4}', result):
            result += f" {year_to_append}"
        return result.replace("  ", " ").strip()

def diagnose():
    path = r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.xlsx"
    print(f"Reading {path}...")
    try:
        excel = fastexcel.read_excel(path)
        sheet = excel.load_sheet(excel.sheet_names[0], header_row=None)
        df = sheet.to_polars()
        
        # Find column that matches JADWAL
        jadwal_col_idx = -1
        # Scan first few rows for headers
        for i in range(10):
            row = [str(x).lower() for x in df.row(i) if x is not None]
            for idx, val in enumerate(row):
                if any(alias in val for alias in ["jadwal", "tanam"]):
                    jadwal_col_idx = idx
                    print(f"Found Jadwal column at index {idx} in row {i}: '{df.row(i)[idx]}'")
                    break
            if jadwal_col_idx != -1: break
            
        if jadwal_col_idx == -1:
            print("Could not find Jadwal column automatically.")
            return

        # Sample values
        values = df.select(pl.col(df.columns[jadwal_col_idx])).slice(i+1, 20).to_series().to_list()
        print("\nRaw Values in Column:")
        for v in values:
            print(f"  '{v}' (type: {type(v)})")

        healer = EliteJadwalHealer(dominant_year=2025)
        print("\nHealed Values:")
        for v in values:
            print(f"  '{v}' -> '{healer.heal(v)}'")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    diagnose()
