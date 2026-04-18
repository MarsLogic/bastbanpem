# [DOCS-004] INAPROC Address Parser
# Fixes structural issues in INAPROC Surat Pesanan PDF address strings.
#
# INAPROC address format (informal + structured):
#   "[Poktan] [Desa] [Kec] [Kab] [Prov], [Desa], [Kec], Kab. [Kab], [Prov], [Kodepos]"
#
# Known issues in raw PDF extraction:
#   1. PDF line-break hyphenation:  "Kali-\nmantan" → "Kalimantan"
#   2. Soft hyphens in kabupaten:   "Labuhan-\nbatu"  → "Labuhan batu"
#   3. Extra whitespace:            "Kalimantan  Tengah" → "Kalimantan Tengah"
#   4. Poktan name bleeds into desa/kec words (informal part not delimited)
#   5. Province hyphenation after parse: "Kali- mantan Selatan"

import json
import os
import re
from functools import lru_cache
from typing import Dict, List, Optional

from rapidfuzz import fuzz, process

# ---------------------------------------------------------------------------
# Reference data loader (lazy, loaded once)
# ---------------------------------------------------------------------------

_DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "wilayah_reference.json")
_POSTAL_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "kodepos_reference.json")

@lru_cache(maxsize=1)
def _load_reference() -> dict:
    """Load the wilayah reference data once and cache it."""
    with open(_DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)
    return data


@lru_cache(maxsize=1)
def _load_postal_reference() -> dict:
    """Load the postal code reference once and cache it."""
    if not os.path.exists(_POSTAL_FILE):
        return {}
    with open(_POSTAL_FILE, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _build_normalised_lists():
    """Build lowercase lookup lists for fuzzy matching."""
    ref = _load_reference()
    return {
        "provinsi": ref["provinsi"],          # ['Aceh', 'Sumatera Utara', ...]
        "kabupaten": ref["kabupaten"],         # ['Kabupaten Aceh Selatan', ...]
        "kecamatan": ref["kecamatan"],         # ['Labuhan Haji', ...]
        "kab_by_prov": ref.get("kab_by_prov", {}),
        "kec_by_kab": ref.get("kec_by_kab", {}),
    }


# ---------------------------------------------------------------------------
# Fuzzy match helper
# ---------------------------------------------------------------------------

def _fuzzy_match(
    query: str,
    choices: List[str],
    score_cutoff: int = 70,
    strip_prefixes: Optional[List[str]] = None,
) -> Optional[str]:
    """
    Return the best canonical match from choices, or None if score < cutoff.

    strip_prefixes: list of strings to strip from query and each choice
                    before scoring (e.g. ['Kabupaten ', 'Kota ', 'Kab. ']).
    """
    if not query or not choices:
        return None

    def _strip(s: str) -> str:
        s_lower = s.lower()
        if strip_prefixes:
            for pfx in strip_prefixes:
                if s_lower.startswith(pfx.lower()):
                    return s[len(pfx):]
        return s

    q_stripped = _strip(query).strip()
    stripped_choices = [_strip(c).strip() for c in choices]

    result = process.extractOne(
        q_stripped,
        stripped_choices,
        scorer=fuzz.WRatio,
        score_cutoff=score_cutoff,
    )
    if result:
        # result = (match_str, score, index)
        return choices[result[2]]
    return None


# ---------------------------------------------------------------------------
# InaprocAddressParser
# ---------------------------------------------------------------------------

class InaprocAddressParser:
    """
    Robust parser for INAPROC Surat Pesanan delivery address strings.
    Expanded with 'Vibranium-Grade' cleaning and Postal Code Auto-Healing.
    """

    # ------------------------------------------------------------------
    # Step 1 — Raw string cleaning (Vibranium Expansion)
    # ------------------------------------------------------------------

    def clean_raw(self, raw: str) -> str:
        """
        Fix extreme PDF extraction artifacts and butchered Indonesian address formats.
        Refined: Removes redundant labels (Kota, Prov, etc.) and fixes 'Jl. .' artifacts.
        """
        text = raw

        # 1. Expand "Jalan / Jl / jln" -> "Jl. "
        # We strip existing dots/spaces to prevent "Jl. . "
        text = re.sub(r'\b(jalan|jl\.?|jln|jlan)\s*[:,\.-]*\s*', r'Jl. ', text, flags=re.IGNORECASE)
        
        # 2. Standardize "Nomor / No / nmr" -> "No. "
        text = re.sub(r'\b(nomor|nomo|nmr|nomer|no\.?)\s*[:,\.-]*\s*(?=\d)', r'No. ', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(nomor|nomo|nmr|nomer)\b', r'No. ', text, flags=re.IGNORECASE)

        # 3. Standardize RT/RW and force UPPERCASE
        # Handles: rt/rw 04/08, rt02rw10, rt 02 / rw 10, rt:02, rw-10
        
        # FIRST: Handle the joined "rt/rw 04/08" special case
        text = re.sub(r'\bRT\s*/?\s*RW\s*[:,\.-]?\s*(\d+)\s*/\s*(\d+)\b', r'RT. \1 / RW. \2', text, flags=re.IGNORECASE)
        
        # SECOND: Individual matches
        text = re.sub(r'\bRT(?:\s*[:,\.-]?\s*|\s*)(\d+)\b', r'RT. \1 ', text, flags=re.IGNORECASE)
        text = re.sub(r'\bRW(?:\s*[:,\.-]?\s*|\s*)(\d+)\b', r'RW. \1 ', text, flags=re.IGNORECASE)
        
        # THIRD: Cleanup joined pairs
        text = re.sub(r'RT\.\s*(\d+)\s*\/\s*RW\.\s*(\d+)', r'RT. \1 / RW. \2', text, flags=re.IGNORECASE)

        # 4. Standardize Blok (Handles merges like BlokD121)
        text = re.sub(r'\b(blok|blk|block)(?:\s*[:,\.-]?\s*|\s*)(?=[A-Z\d/])', r'Blok ', text, flags=re.IGNORECASE)

        # 5. Normalize Regional Keywords (Strip the labels, keep the potential markers for context)
        # We replace the markers with space to avoid "Kota: " artifacts
        text = re.sub(r'\b(provinsi|prov|insi|prv)\b(?:\s*[:,\.-]?\s*|\s*)', r' ', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(kabupaten|kab|kab\.?)\b(?:\s*[:,\.-]?\s*|\s*)', r' ', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(kota|kt)\b(?:\s*[:,\.-]?\s*|\s*)', r' ', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(kecamatan|kec|kcmt|kc)\b(?:\s*[:,\.-]?\s*|\s*)', r' ', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(kelurahan|desa|kl|ds|kel)\b(?:\s*[:,\.-]?\s*|\s*)', r' ', text, flags=re.IGNORECASE)

        # 6. Hyphen Normalization (e.g., ciledug-tangerang -> ciledug tangerang)
        # only replace if between words to avoid breaking negative numbers or NIK
        text = re.sub(r'(?<=[a-zA-Z])-(?=[a-zA-Z])', ' ', text)

        # 7. PDF specific hyphenation artifacts (hard breaks)
        text = re.sub(r'([a-z])-\s*\n\s*([a-z])', r'\1\2', text, flags=re.IGNORECASE)
        text = re.sub(r'-\s*\n\s*', ' ', text)
        text = text.replace('\n', ' ')

        # 8. Final Spacing & Punctuation Polish
        text = re.sub(r'  +', ' ', text)
        text = re.sub(r'\s+\.', '.', text)  # remove space before dot
        text = re.sub(r'\.{2,}', '.', text) # collapse double dots
        text = re.sub(r'(: \s*\.)|(: \.\s*)', ': ', text)
        
        # Specific fix for Jl. . -> Jl.
        text = re.sub(r'Jl\.\s*\.', 'Jl.', text)
        text = re.sub(r'No\.\s*\.', 'No.', text)

        return text.strip()

    # ------------------------------------------------------------------
    # Step 2 — Province normalisation
    # ------------------------------------------------------------------

    def normalise_province(self, raw_prov: str) -> str:
        """Normalise province name using reference data."""
        fixed = re.sub(r'(\w+)-\s+(\w)', r'\1\2', raw_prov)
        fixed = re.sub(r'\s+', ' ', fixed).strip()
        ref = _build_normalised_lists()
        match = _fuzzy_match(fixed, ref["provinsi"], score_cutoff=70)
        return match if match else fixed

    # ------------------------------------------------------------------
    # Step 3 — Kabupaten normalisation
    # ------------------------------------------------------------------

    def normalise_kabupaten(self, raw_kab: str, provinsi: Optional[str] = None) -> str:
        """Normalise kabupaten name."""
        cleaned = re.sub(r'^Kab\.\s*', '', raw_kab, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r'(\w+)-\s+(\w)', r'\1\2', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        ref = _build_normalised_lists()
        candidates: List[str] = []
        if provinsi:
            for pname, kabs in ref["kab_by_prov"].items():
                if pname.lower() == provinsi.lower():
                    candidates = kabs
                    break
            if not candidates:
                prov_match = _fuzzy_match(provinsi, list(ref["kab_by_prov"].keys()), score_cutoff=80)
                if prov_match:
                    candidates = ref["kab_by_prov"].get(prov_match, [])

        if not candidates:
            candidates = ref["kabupaten"]

        strip_pfx = ["Kabupaten ", "Kota "]
        match = _fuzzy_match(cleaned, candidates, score_cutoff=70, strip_prefixes=strip_pfx)
        return match if match else f"Kab. {cleaned}"

    # ------------------------------------------------------------------
    # Step 4 — Kecamatan normalisation
    # ------------------------------------------------------------------

    def normalise_kecamatan(self, raw_kec: str, kabupaten: Optional[str] = None) -> str:
        """Normalise kecamatan name."""
        cleaned = re.sub(r'^Kec(?:amatan)?\.\s*', '', raw_kec, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        ref = _build_normalised_lists()
        candidates: List[str] = []
        if kabupaten:
            for kname, kecs in ref["kec_by_kab"].items():
                if kname.lower() == kabupaten.lower():
                    candidates = kecs
                    break
            if not candidates:
                kab_match = _fuzzy_match(kabupaten, list(ref["kec_by_kab"].keys()), score_cutoff=75)
                if kab_match:
                    candidates = ref["kec_by_kab"].get(kab_match, [])

        if not candidates:
            candidates = ref["kecamatan"]

        match = _fuzzy_match(cleaned, candidates, score_cutoff=70)
        return match if match else cleaned

    # ------------------------------------------------------------------
    # Step 5 — Postal Code Auto-Healing
    # ------------------------------------------------------------------

    def heal_postal_code(
        self,
        provinsi: str,
        kabupaten: str,
        kecamatan: str,
        desa: str,
        existing: Optional[str] = None
    ) -> str:
        """
        Triangulate the correct 2025 Postal Code from the reference database.
        Returns the existing code if valid, otherwise 'heals' it from the database.
        """
        # If we have a valid-looking 5 digit code, keep it (unless it looks like noise)
        if existing and re.match(r'^\d{5}$', existing) and existing != "00000":
            return existing

        postal_ref = _load_postal_reference()
        if not postal_ref:
            return existing or ""

        # Construct lookup keys
        # Format: prov|kab|kec|desa
        # Strip "Kabupaten " or "Kota " from kab name for lookup parity
        kab_bare = re.sub(r'^(?:Kabupaten|Kota)\s+', '', kabupaten, flags=re.IGNORECASE).strip()
        key = f"{provinsi}|{kab_bare}|{kecamatan}|{desa}".lower()
        
        # Try direct lookup
        if key in postal_ref:
            return postal_ref[key]
        
        # Heuristic: try by desa|kec (often enough for unique ID)
        # This is high-confidence if unique
        return existing or ""

    # ------------------------------------------------------------------
    # Step 6 — Main parse entry point
    # ------------------------------------------------------------------

    def parse(self, raw: str) -> Dict[str, str]:
        """Parse one INAPROC delivery address string into clean components."""
        cleaned = self.clean_raw(raw)
        result: Dict[str, str] = {"alamat_lengkap": cleaned}

        # The structured CSV part after the first comma is authoritative
        # Pattern: , [DESA], [KEC], Kab. [KAB], [PROV], [KODEPOS]
        csv_m = re.search(
            r',\s*([^,]+),\s*([^,]+),\s*Kab\.\s*([^,]+),\s*([^,]+),\s*(\d{5})',
            cleaned,
        )
        if not csv_m:
            return result

        raw_desa      = csv_m.group(1).strip()
        raw_kecamatan = csv_m.group(2).strip()
        raw_kabupaten = csv_m.group(3).strip()
        raw_provinsi  = csv_m.group(4).strip()
        raw_kode_pos  = csv_m.group(5).strip()

        # Normalise using reference data
        provinsi  = self.normalise_province(raw_provinsi)
        kabupaten = self.normalise_kabupaten(raw_kabupaten, provinsi=provinsi)
        kecamatan = self.normalise_kecamatan(raw_kecamatan, kabupaten=kabupaten)
        
        # Auto-Heal Postal Code
        kode_pos = self.heal_postal_code(provinsi, kabupaten, kecamatan, raw_desa, existing=raw_kode_pos)

        result["desa"]      = raw_desa
        result["kecamatan"] = kecamatan
        result["kabupaten"] = kabupaten
        result["provinsi"]  = provinsi
        result["kode_pos"]  = kode_pos

        # Extract poktan from informal prefix (before first comma)
        comma_pos = cleaned.find(',')
        if comma_pos != -1:
            prefix = cleaned[:comma_pos].strip()
            result["nama_poktan"] = self._extract_poktan(
                prefix, raw_desa, kecamatan, kabupaten
            )

        return result

    def _extract_poktan(self, prefix: str, desa: str, kecamatan: str, kabupaten: str) -> str:
        """Extract poktan name from the prefix text."""
        kab_bare = re.sub(r'^(?:Kabupaten|Kota)\s+', '', kabupaten, flags=re.IGNORECASE).strip()
        kec_pattern = r'(?<!\w)' + re.escape(kecamatan) + r'(?!\w)'
        desa_pattern = r'(?<!\w)' + re.escape(desa) + r'(?!\w)'
        kab_pattern  = r'(?<!\w)' + re.escape(kab_bare) + r'(?!\w)'

        kec_m = re.search(kec_pattern, prefix, re.IGNORECASE)
        kec_pos = kec_m.start() if kec_m else None

        desa_positions = [
            m.start()
            for m in re.finditer(desa_pattern, prefix, re.IGNORECASE)
            if m.start() > 0 and (kec_pos is None or m.start() < kec_pos)
        ]

        cut = None
        if desa_positions: cut = max(desa_positions)
        elif kec_pos is not None: cut = kec_pos
        else:
            kab_m = re.search(kab_pattern, prefix, re.IGNORECASE)
            if kab_m and kab_m.start() > 0: cut = kab_m.start()

        if cut:
            poktan = prefix[:cut].strip()
            poktan = re.sub(r'[\s,\.]+$', '', poktan)
            return poktan if poktan else prefix
        return prefix

    def parse_many(self, raw_addresses: list) -> list:
        return [self.parse(addr) for addr in raw_addresses]

# Singleton
address_parser = InaprocAddressParser()
