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

@lru_cache(maxsize=1)
def _load_reference() -> dict:
    """Load the wilayah reference data once and cache it."""
    with open(_DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)
    return data


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

    Usage:
        parser = InaprocAddressParser()
        result = parser.parse("BP. SEJAHTERA Sei Penggantungan Panai Hilir Labuhan batu Sumatera Utara, Sei Penggantungan, Panai Hilir, Kab. Labuhan-\\nbatu, Sumatera Utara, 21473")
        # result = {
        #   "alamat_lengkap": "...",
        #   "nama_poktan":    "BP. SEJAHTERA",
        #   "desa":           "Sei Penggantungan",
        #   "kecamatan":      "Panai Hilir",
        #   "kabupaten":      "Kabupaten Labuhanbatu",
        #   "provinsi":       "Sumatera Utara",
        #   "kode_pos":       "21473",
        # }
    """

    # ------------------------------------------------------------------
    # Step 1 — Raw string cleaning
    # ------------------------------------------------------------------

    def clean_raw(self, raw: str) -> str:
        """
        Fix PDF extraction artifacts before any parsing.

        Handles:
        - Hard word-break hyphen:  "Kali-\\nmantan"   → "Kalimantan"
        - Soft hyphen (space gap): "Labuhan-\\n batu"  → "Labuhan batu"
        - Trailing/leading space around newlines
        - Collapsed double spaces
        """
        text = raw

        # 1. Hard word-break hyphen: word-\nword → word word (keep hyphen if both sides are caps → likely abbreviation)
        text = re.sub(r'([a-z])-\s*\n\s*([a-z])', r'\1\2', text, flags=re.IGNORECASE)

        # 2. Remaining newline hyphens (e.g. "Kab. Labuhan-\nbatu") → add space
        text = re.sub(r'-\s*\n\s*', ' ', text)

        # 3. Strip remaining bare newlines (replace with single space)
        text = text.replace('\n', ' ')

        # 4. Collapse multiple spaces
        text = re.sub(r'  +', ' ', text)

        return text.strip()

    # ------------------------------------------------------------------
    # Step 2 — Province normalisation
    # ------------------------------------------------------------------

    def normalise_province(self, raw_prov: str) -> str:
        """
        Normalise province string using reference data + fuzzy matching.
        - Fix hyphenation: "Kali- mantan Selatan" → "Kalimantan Selatan"
        - Fix spacing artifacts
        - Fuzzy-match against 38 canonical province names
        """
        # Fix residual hyphenation ("Kali- mantan Selatan")
        fixed = re.sub(r'(\w+)-\s+(\w)', r'\1\2', raw_prov)
        fixed = re.sub(r'\s+', ' ', fixed).strip()

        ref = _build_normalised_lists()
        match = _fuzzy_match(fixed, ref["provinsi"], score_cutoff=70)
        return match if match else fixed

    # ------------------------------------------------------------------
    # Step 3 — Kabupaten normalisation
    # ------------------------------------------------------------------

    def normalise_kabupaten(self, raw_kab: str, provinsi: Optional[str] = None) -> str:
        """
        Normalise kabupaten string using reference data + fuzzy matching.
        - Accepts raw name with or without "Kab." prefix
        - Narrows candidate list to the given province when available
        - Returns canonical form: "Kabupaten X" or "Kota X"
        """
        # Strip known INAPROC prefixes
        cleaned = re.sub(r'^Kab\.\s*', '', raw_kab, flags=re.IGNORECASE).strip()
        # Fix residual hyphenation
        cleaned = re.sub(r'(\w+)-\s+(\w)', r'\1\2', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        ref = _build_normalised_lists()

        # Narrow to province's kabupaten list when possible
        candidates: List[str] = []
        if provinsi:
            # Try exact province key first, then fuzzy
            for pname, kabs in ref["kab_by_prov"].items():
                if pname.lower() == provinsi.lower():
                    candidates = kabs
                    break
            if not candidates:
                # province name may differ slightly
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
        """
        Normalise kecamatan string using reference data + fuzzy matching.
        - Accepts raw name with or without "Kec." prefix
        - Narrows candidate list to the given kabupaten when available
        - Returns canonical form without prefix
        """
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
    # Step 5 — Poktan extraction
    # ------------------------------------------------------------------

    def _extract_poktan(
        self,
        prefix: str,
        desa: str,
        kecamatan: str,
        kabupaten: str,
    ) -> str:
        """
        Extract poktan name from the INAPROC informal address prefix.

        Algorithm:
          1. Locate kecamatan in the prefix — this gives us a hard right boundary.
          2. Find ALL occurrences of desa before that boundary (excluding pos 0).
             Take the LAST one — this handles "BP Simpang Datuk Satu Simpang Datuk …"
             where the poktan itself contains the desa word.
          3. If desa not found, fall back to kecamatan boundary.
          4. If neither found, try kabupaten as last resort.
          5. Return full prefix unchanged if nothing matched.
        """
        # Strip "Kabupaten "/"Kota " for matching in prefix text
        kab_bare = re.sub(r'^(?:Kabupaten|Kota)\s+', '', kabupaten, flags=re.IGNORECASE).strip()

        kec_pattern = r'(?<!\w)' + re.escape(kecamatan) + r'(?!\w)'
        desa_pattern = r'(?<!\w)' + re.escape(desa) + r'(?!\w)'
        kab_pattern  = r'(?<!\w)' + re.escape(kab_bare) + r'(?!\w)'

        # Step 1 — kecamatan boundary
        kec_m = re.search(kec_pattern, prefix, re.IGNORECASE)
        kec_pos = kec_m.start() if kec_m else None

        # Step 2 — all desa occurrences at pos > 0, constrained to before kecamatan
        desa_positions = [
            m.start()
            for m in re.finditer(desa_pattern, prefix, re.IGNORECASE)
            if m.start() > 0 and (kec_pos is None or m.start() < kec_pos)
        ]

        cut = None
        if desa_positions:
            cut = max(desa_positions)
        elif kec_pos is not None:
            cut = kec_pos
        else:
            kab_m = re.search(kab_pattern, prefix, re.IGNORECASE)
            if kab_m and kab_m.start() > 0:
                cut = kab_m.start()

        if cut:
            poktan = prefix[:cut].strip()
            poktan = re.sub(r'[\s,\.]+$', '', poktan)
            return poktan if poktan else prefix

        return prefix

    # ------------------------------------------------------------------
    # Step 6 — Main parse entry point
    # ------------------------------------------------------------------

    def parse(self, raw: str) -> Dict[str, str]:
        """
        Parse one INAPROC delivery address string into clean components.

        Returns dict with keys:
            alamat_lengkap, nama_poktan, desa, kecamatan,
            kabupaten, provinsi, kode_pos
        """
        cleaned = self.clean_raw(raw)
        result: Dict[str, str] = {"alamat_lengkap": cleaned}

        # The structured CSV part after the first comma is authoritative
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
        kode_pos      = csv_m.group(5).strip()

        # Normalise using reference data
        provinsi  = self.normalise_province(raw_provinsi)
        kabupaten = self.normalise_kabupaten(raw_kabupaten, provinsi=provinsi)
        kecamatan = self.normalise_kecamatan(raw_kecamatan, kabupaten=kabupaten)

        result["desa"]      = raw_desa
        result["kecamatan"] = kecamatan
        result["kabupaten"] = kabupaten
        result["provinsi"]  = provinsi
        result["kode_pos"]  = kode_pos

        # Extract poktan from informal prefix (before first comma)
        comma_pos = cleaned.index(',')
        prefix    = cleaned[:comma_pos].strip()
        result["nama_poktan"] = self._extract_poktan(
            prefix, raw_desa, kecamatan, kabupaten
        )

        return result

    def parse_many(self, raw_addresses: list) -> list:
        """Parse a list of raw address strings, return list of result dicts."""
        return [self.parse(addr) for addr in raw_addresses]


# Singleton for import
address_parser = InaprocAddressParser()
