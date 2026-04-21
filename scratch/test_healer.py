
import re
from typing import Any, Optional, List

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
        raw_s = str(val).strip()
        s = raw_s.lower()
        
        # 1. Quick Shorthand Aliases (Okmar, etc)
        for alias, (start, end) in self.SHORTHAND_RANGES.items():
            if alias in s:
                res = f"{start} - {end}"
                y_in_s = re.search(r'\d{4}', raw_s)
                if y_in_s:
                    res += f" {y_in_s.group()}"
                elif self.dominant_year:
                    res += f" {self.dominant_year}"
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

healer = EliteJadwalHealer(2025)
print(f"April 2025 -> {healer.heal('April 2025')}")
print(f"Oktober -> {healer.heal('Oktober')}")
print(f"okmar -> {healer.heal('okmar')}")
print(f"April -> {healer.heal('April')}")
print(f"2025 -> {healer.heal('2025')}")
