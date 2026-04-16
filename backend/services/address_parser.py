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

import re
from typing import Dict, Optional

# ---------------------------------------------------------------------------
# Indonesian province normalisation table
# Handles known INAPROC hyphenation and casing variants
# ---------------------------------------------------------------------------
PROVINCE_FIXES: Dict[str, str] = {
    "kalimantan selatan":  "Kalimantan Selatan",
    "kalimantan barat":    "Kalimantan Barat",
    "kalimantan tengah":   "Kalimantan Tengah",
    "kalimantan timur":    "Kalimantan Timur",
    "kalimantan utara":    "Kalimantan Utara",
    "sulawesi selatan":    "Sulawesi Selatan",
    "sulawesi tengah":     "Sulawesi Tengah",
    "sulawesi tenggara":   "Sulawesi Tenggara",
    "sulawesi barat":      "Sulawesi Barat",
    "sulawesi utara":      "Sulawesi Utara",
    "sumatera utara":      "Sumatera Utara",
    "sumatera selatan":    "Sumatera Selatan",
    "sumatera barat":      "Sumatera Barat",
    "nusa tenggara barat": "Nusa Tenggara Barat",
    "nusa tenggara timur": "Nusa Tenggara Timur",
    "papua barat":         "Papua Barat",
    "kepulauan riau":      "Kepulauan Riau",
    "kepulauan bangka belitung": "Kepulauan Bangka Belitung",
    "dki jakarta":         "DKI Jakarta",
    "di yogyakarta":       "DI Yogyakarta",
    "bangka belitung":     "Kepulauan Bangka Belitung",
    "jawa barat":          "Jawa Barat",
    "jawa tengah":         "Jawa Tengah",
    "jawa timur":          "Jawa Timur",
}


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
        #   "kabupaten":      "Kab. Labuhan batu",
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
        - Hard hyphen word-break:  "Kali-\\nmantan"   → "Kalimantan"
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
        Normalise province string:
        - Fix hyphenation: "Kali- mantan Selatan" → "Kalimantan Selatan"
        - Fix spacing: "Kalimantan  Selatan" → "Kalimantan Selatan"
        - Apply canonical casing from PROVINCE_FIXES table.
        """
        # Fix residual hyphenation ("Kali- mantan Selatan")
        fixed = re.sub(r'(\w+)-\s+(\w)', r'\1\2', raw_prov)
        # Collapse spaces
        fixed = re.sub(r'\s+', ' ', fixed).strip()
        # Lookup canonical form (case-insensitive)
        canonical = PROVINCE_FIXES.get(fixed.lower())
        return canonical if canonical else fixed

    # ------------------------------------------------------------------
    # Step 3 — Poktan extraction
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

        Handles all INAPROC edge cases:
          - Poktan starts with desa word (e.g. "SEMABI KOMPLEKS Semabi …")
          - Poktan contains desa word repeated (e.g. "BP Simpang Datuk Satu Simpang Datuk …")
          - Formal desa ≠ informal desa (uses kecamatan boundary instead)
        """
        kec_pattern = r'(?<!\w)' + re.escape(kecamatan) + r'(?!\w)'
        desa_pattern = r'(?<!\w)' + re.escape(desa) + r'(?!\w)'
        kab_pattern  = r'(?<!\w)' + re.escape(kabupaten) + r'(?!\w)'

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
            # Take the LAST valid desa occurrence (handles repeated desa words in poktan)
            cut = max(desa_positions)
        elif kec_pos is not None:
            # Desa not in prefix (formal ≠ informal) — use kecamatan boundary
            cut = kec_pos
        else:
            # Last resort: kabupaten
            kab_m = re.search(kab_pattern, prefix, re.IGNORECASE)
            if kab_m and kab_m.start() > 0:
                cut = kab_m.start()

        if cut:
            poktan = prefix[:cut].strip()
            poktan = re.sub(r'[\s,\.]+$', '', poktan)  # remove trailing punctuation
            return poktan if poktan else prefix

        return prefix

    # ------------------------------------------------------------------
    # Step 4 — Main parse entry point
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
            # Fallback: return cleaned string only, no location decomposition
            return result

        raw_desa      = csv_m.group(1).strip()
        raw_kecamatan = csv_m.group(2).strip()
        raw_kabupaten = csv_m.group(3).strip()
        raw_provinsi  = csv_m.group(4).strip()
        kode_pos      = csv_m.group(5).strip()

        # Normalise province
        provinsi = self.normalise_province(raw_provinsi)

        result["desa"]      = raw_desa
        result["kecamatan"] = raw_kecamatan
        result["kabupaten"] = f"Kab. {raw_kabupaten}"
        result["provinsi"]  = provinsi
        result["kode_pos"]  = kode_pos

        # Extract poktan from informal prefix (before first comma)
        comma_pos = cleaned.index(',')
        prefix    = cleaned[:comma_pos].strip()
        result["nama_poktan"] = self._extract_poktan(
            prefix, raw_desa, raw_kecamatan, raw_kabupaten
        )

        return result

    def parse_many(self, raw_addresses: list) -> list:
        """Parse a list of raw address strings, return list of result dicts."""
        return [self.parse(addr) for addr in raw_addresses]


# Singleton for import
address_parser = InaprocAddressParser()
