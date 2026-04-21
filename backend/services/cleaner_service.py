import re
from typing import Set, List, Optional

class CleanerService:
    # --- Title Case Configuration ---
    PREFIXES = {'as', 'pt', 'cv', 'ud', 'bp', 'kp', 'pd', 'sk', 'sj', 'kk', 'gr', 'ny', 'tn', 'dr', 'rd', 'kwt', 'kud', 'upj', 'lmd'}
    PRESERVE = {'PPK', 'NPWP', 'NIK', 'KTP', 'CV', 'PT', 'TBK', 'UD', 'PD', 'SPM', 'SK', 'IVA', 'Gapoktan', 'Poktan', 'KWT', 'UPJA', 'LMDH', 'Koperasi', 'KUD', 'BUMDes'}
    UP_SHORT = {'AS', 'PT', 'CV', 'UD', 'BP', 'KP', 'PD', 'SK', 'SJ', 'KK', 'GR', 'NY', 'TN', 'DR', 'RD', 'KWT', 'KUD', 'UPJ', 'LMD'}

    def to_title_case(self, text: str) -> str:
        if not text: return ""
        
        # 1. Initial cleanup
        s = text.strip()
        # Add space after common punctuation if merged with text
        s = re.sub(r'([.,\/\-])([a-zA-Z])', r'\1 \2', s)

        # 2. Pre-process prefixes
        def prefix_replacer(match):
            prefix = match.group(1)
            punct = match.group(2)
            p_low = prefix.lower()
            if punct or p_low in self.PREFIXES:
                punctuation = punct if punct else "."
                return f"{prefix.upper()}{punctuation} "
            return match.group(0)

        s = re.sub(r'\b([a-zA-Z]{2,3})\b([.,\/\-])?\s*', prefix_replacer, s)

        # 3. Main word loop
        words = s.split()
        result = []
        for word in words:
            if not word: continue
            
            # Clean word from trailing punctuation
            clean_word = re.sub(r'[.,\/\-]$', '', word)
            upper = clean_word.upper()
            punct = word[len(clean_word):]

            # Check preserve lists
            if upper in self.PRESERVE:
                result.append(upper + punct)
                continue
            if clean_word in self.PRESERVE: # Mixed case
                result.append(clean_word + punct)
                continue
            if upper in self.UP_SHORT:
                result.append(upper + punct)
                continue

            # Handle parentheses
            if word.startswith('(') and word.endswith(')'):
                inner = word[1:-1].upper()
                if inner in self.PRESERVE or inner in self.UP_SHORT:
                    result.append(f"({inner})")
                    continue

            # Standard Title Case
            lowered = word.lower()
            result.append(lowered.capitalize())

        return " ".join(result).strip()

    def clean_address(self, text: str) -> str:
        if not text: return ""
        s = text.strip()

        # Expand abbreviations
        s = re.sub(r'\b(jalan|jl\.?|jln|jlan)\s*[:,\.-]*\s*', 'Jl. ', s, flags=re.IGNORECASE)
        s = re.sub(r'\b(nomor|nomo|nmr|nomer|no\.?)\s*[:,\.-]*\s*(?=\d)', 'No. ', s, flags=re.IGNORECASE)
        
        # Strip regional labels
        s = re.sub(r'\b(provinsi|prov|insi|prv)\b(?:\s*[:,\.-]?\s*|\s*)', ' ', s, flags=re.IGNORECASE)
        s = re.sub(r'\b(kabupaten|kab|kab\.?)\b(?:\s*[:,\.-]?\s*|\s*)', ' ', s, flags=re.IGNORECASE)
        s = re.sub(r'\b(kecamatan|kec|kcmt|kc)\b(?:\s*[:,\.-]?\s*|\s*)', ' ', s, flags=re.IGNORECASE)
        s = re.sub(r'\b(kelurahan|desa|kl|ds|kel)\b(?:\s*[:,\.-]?\s*|\s*)', ' ', s, flags=re.IGNORECASE)

        # RT/RW
        s = re.sub(r'\bRT\s*[:,\.-]?\s*(\d+)\b', r'RT \1 ', s, flags=re.IGNORECASE)
        s = re.sub(r'\bRW\s*[:,\.-]?\s*(\d+)\b', r'RW \1 ', s, flags=re.IGNORECASE)
        
        # Polish
        s = re.sub(r'\s+', ' ', s)
        result = self.to_title_case(s)
        # Restore pure RT/RW caps
        result = re.sub(r'\bRt\b', 'RT', result)
        result = re.sub(r'\bRw\b', 'RW', result)
        
        return result

    def clean_value(self, val: str, label: Optional[str] = None) -> str:
        if not val or val.strip() in ("", "—", "UNKNOWN"): return val
        
        key = (label or "").lower()
        cleaned = val.strip()

        if "alamat" in key:
            cleaned = self.clean_address(cleaned)
        elif any(k in key for k in ["nama", "penerima", "poktan", "group"]):
            cleaned = self.to_title_case(cleaned)
        elif any(k in key for k in ["telepon", "hp"]):
            # Simple digit extraction
            cleaned = re.sub(r'\D', '', cleaned)
            if cleaned.startswith('8'): cleaned = '0' + cleaned
        
        return re.sub(r'\s+', ' ', cleaned).strip()

cleaner_service = CleanerService()
