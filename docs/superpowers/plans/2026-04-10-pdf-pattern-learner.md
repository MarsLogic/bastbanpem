# PDF Pattern Learner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Python script that recursively reads all Surat Pesanan PDFs, splits each PDF into named sections, extracts every field per section, and outputs `parsed_contracts.json` + `pattern_report.json`.

**Architecture:** Page 1 of each PDF is split into isolated named sections (HEADER, PEMESAN, PAYMENT_SUMMARY, PENYEDIA, RINGKASAN_PESANAN, RINGKASAN_PEMBAYARAN) using sequential anchor detection. All pages are then scanned for repeating PENGIRIMAN blocks. Each section is parsed independently — fields never bleed across section boundaries.

**Tech Stack:** Python 3, pypdf (already installed), re, json, os — zero additional dependencies.

---

## File Structure

```
C:\Users\Wyx\bastbanpem\
  pdf_pattern_learner.py        ← main script (run this)
  test_pdf_parser.py            ← validation tests (run with pytest)
  output\
    parsed_contracts.json       ← generated — one object per PDF
    pattern_report.json         ← generated — field presence + format map
```

---

## Task 1: Script Scaffold + Discovery Pass

**Files:**
- Create: `C:\Users\Wyx\bastbanpem\pdf_pattern_learner.py`
- Create: `C:\Users\Wyx\bastbanpem\test_pdf_parser.py`

- [ ] **Step 1.1: Write the failing test for discovery**

Create `test_pdf_parser.py`:

```python
import pytest
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from pdf_pattern_learner import discover_pdfs, is_valid_pdf

PDF_ROOT = r"C:\Users\Wyx\Desktop\Project 2026"

def test_discovers_at_least_80_pdfs():
    paths = discover_pdfs(PDF_ROOT)
    assert len(paths) >= 80, f"Expected 80+ PDFs, got {len(paths)}"

def test_filters_out_corrupt_xlsx_disguised_as_pdf():
    # The KRESNACID folder has an xlsx file with .pdf extension
    # Its magic bytes are PK\x03\x04 (zip/xlsx), not %PDF
    paths = discover_pdfs(PDF_ROOT)
    for p in paths:
        assert is_valid_pdf(p), f"Invalid PDF slipped through: {p}"

def test_all_discovered_paths_end_with_pdf():
    paths = discover_pdfs(PDF_ROOT)
    for p in paths:
        assert p.lower().endswith('.pdf'), f"Non-PDF path found: {p}"
```

- [ ] **Step 1.2: Run test to confirm it fails**

```bash
cd C:\Users\Wyx\bastbanpem
python -m pytest test_pdf_parser.py::test_discovers_at_least_80_pdfs -v
```

Expected: `ModuleNotFoundError: No module named 'pdf_pattern_learner'`

- [ ] **Step 1.3: Create the script with discovery functions**

Create `pdf_pattern_learner.py`:

```python
import os
import re
import json
import pypdf

PDF_ROOT = r"C:\Users\Wyx\Desktop\Project 2026"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


def is_valid_pdf(path: str) -> bool:
    """Return True if file starts with PDF magic bytes %PDF."""
    try:
        with open(path, 'rb') as f:
            header = f.read(4)
        return header == b'%PDF'
    except OSError:
        return False


def discover_pdfs(root: str) -> list[str]:
    """Recursively find all valid PDF files under root."""
    found = []
    for dirpath, _, filenames in os.walk(root):
        for fname in filenames:
            if fname.lower().endswith('.pdf'):
                full = os.path.join(dirpath, fname)
                if is_valid_pdf(full):
                    found.append(full)
    return found


if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    pdfs = discover_pdfs(PDF_ROOT)
    print(f"Discovered {len(pdfs)} valid PDFs")
```

- [ ] **Step 1.4: Run test to confirm it passes**

```bash
python -m pytest test_pdf_parser.py -v
```

Expected:
```
PASSED test_pdf_parser.py::test_discovers_at_least_80_pdfs
PASSED test_pdf_parser.py::test_filters_out_corrupt_xlsx_disguised_as_pdf
PASSED test_pdf_parser.py::test_all_discovered_paths_end_with_pdf
```

- [ ] **Step 1.5: Commit**

```bash
cd C:\Users\Wyx\bastbanpem
git add pdf_pattern_learner.py test_pdf_parser.py
git commit -m "feat: pdf learner - discovery pass with magic byte validation"
```

---

## Task 2: Page-by-Page Text Extraction

**Files:**
- Modify: `pdf_pattern_learner.py` — add `extract_pages()`
- Modify: `test_pdf_parser.py` — add extraction tests

- [ ] **Step 2.1: Write failing test**

Add to `test_pdf_parser.py`:

```python
from pdf_pattern_learner import extract_pages

SAMPLE_PDF = r"C:\Users\Wyx\Desktop\Project 2026\KAN\Bandung\surat-pesanan-EP-01K7N8N66XF1P31F35YXJJ1RFG.pdf"

def test_extract_pages_returns_list_of_strings():
    pages = extract_pages(SAMPLE_PDF)
    assert isinstance(pages, list)
    assert len(pages) == 54  # known page count
    assert all(isinstance(p, str) for p in pages)

def test_page_1_contains_nomor_surat():
    pages = extract_pages(SAMPLE_PDF)
    assert "No. Surat Pesanan" in pages[0]

def test_page_1_contains_pemesan_and_penyedia():
    pages = extract_pages(SAMPLE_PDF)
    assert "Pemesan" in pages[0]
    assert "Penyedia" in pages[0]

def test_page_2_contains_pengiriman():
    pages = extract_pages(SAMPLE_PDF)
    # Page 2 starts delivery blocks
    assert "Nama Penerima" in pages[1]
```

- [ ] **Step 2.2: Run test to confirm it fails**

```bash
python -m pytest test_pdf_parser.py::test_extract_pages_returns_list_of_strings -v
```

Expected: `ImportError: cannot import name 'extract_pages'`

- [ ] **Step 2.3: Implement extract_pages**

Add to `pdf_pattern_learner.py` after the `discover_pdfs` function:

```python
def extract_pages(pdf_path: str) -> list[str]:
    """
    Extract text from each page as a separate string.
    Returns a list where index 0 = page 1 text, index 1 = page 2 text, etc.
    Each page's text items are joined with a single space and normalised.
    """
    reader = pypdf.PdfReader(pdf_path)
    pages = []
    for page in reader.pages:
        raw = page.extract_text() or ""
        # Collapse all whitespace runs to single space, strip edges
        normalised = re.sub(r'\s+', ' ', raw).strip()
        pages.append(normalised)
    return pages
```

- [ ] **Step 2.4: Run tests**

```bash
python -m pytest test_pdf_parser.py -v
```

Expected: all 7 tests PASS

- [ ] **Step 2.5: Commit**

```bash
git add pdf_pattern_learner.py test_pdf_parser.py
git commit -m "feat: pdf learner - page-by-page text extraction"
```

---

## Task 3: Section Splitter — Page 1 Sections

This is the core of the design. Page 1 contains all contract-level fields. We split it into isolated named sections so each parser only sees its own data.

**Files:**
- Modify: `pdf_pattern_learner.py` — add `split_page1_sections()`
- Modify: `test_pdf_parser.py` — add section tests

- [ ] **Step 3.1: Write failing tests**

Add to `test_pdf_parser.py`:

```python
from pdf_pattern_learner import extract_pages, split_page1_sections

def test_section_keys_present():
    pages = extract_pages(SAMPLE_PDF)
    sections = split_page1_sections(pages[0])
    expected_keys = {
        'HEADER', 'PEMESAN', 'PAYMENT_SUMMARY',
        'PENYEDIA', 'RINGKASAN_PESANAN', 'RINGKASAN_PEMBAYARAN'
    }
    assert expected_keys.issubset(set(sections.keys())), \
        f"Missing keys: {expected_keys - set(sections.keys())}"

def test_header_section_has_nomor_and_tanggal():
    pages = extract_pages(SAMPLE_PDF)
    sections = split_page1_sections(pages[0])
    assert "No. Surat Pesanan" in sections['HEADER']
    assert "Tanggal Surat Pesanan" in sections['HEADER']

def test_pemesan_section_isolated_from_penyedia():
    pages = extract_pages(SAMPLE_PDF)
    sections = split_page1_sections(pages[0])
    # Penyedia company name must NOT appear in Pemesan section
    assert "KARYA ALFREDO" not in sections['PEMESAN']
    # Ministry name must NOT appear in Penyedia section
    assert "DIREKTORAT JENDERAL" not in sections['PENYEDIA']

def test_penyedia_section_has_company_name():
    pages = extract_pages(SAMPLE_PDF)
    sections = split_page1_sections(pages[0])
    assert "KARYA ALFREDO NUSANTARA" in sections['PENYEDIA']

def test_ringkasan_pesanan_has_product_name():
    pages = extract_pages(SAMPLE_PDF)
    sections = split_page1_sections(pages[0])
    assert "INSEKTISIDA VISTA" in sections['RINGKASAN_PESANAN']

def test_no_section_is_empty():
    pages = extract_pages(SAMPLE_PDF)
    sections = split_page1_sections(pages[0])
    for key, text in sections.items():
        assert len(text.strip()) > 10, f"Section '{key}' is suspiciously short: {repr(text)}"
```

- [ ] **Step 3.2: Run to confirm failure**

```bash
python -m pytest test_pdf_parser.py::test_section_keys_present -v
```

Expected: `ImportError: cannot import name 'split_page1_sections'`

- [ ] **Step 3.3: Implement split_page1_sections**

Add to `pdf_pattern_learner.py`:

```python
# Ordered list of (section_name, regex_anchor) pairs.
# Anchors are searched sequentially in page 1 text.
# Each section spans from its anchor to the next anchor's position.
SECTION_ANCHORS = [
    ('HEADER',               r'Surat Pesanan'),
    ('PEMESAN',              r'\bPemesan\b'),
    ('PAYMENT_SUMMARY',      r'Informasi Pembayaran dan Pengiriman'),
    ('PENYEDIA',             r'\bPenyedia\b'),
    ('RINGKASAN_PESANAN',    r'Ringkasan Pesanan'),
    ('RINGKASAN_PEMBAYARAN', r'Ringkasan Pembayaran'),
    ('DETAIL_END',           r'Detail Informasi Pembayaran'),  # sentinel — marks end of page 1 contract data
]


def split_page1_sections(page1_text: str) -> dict[str, str]:
    """
    Split page 1 text into named sections using sequential anchor detection.
    Returns dict mapping section name → section text (anchor label excluded).
    """
    # Find the character position of each anchor in the text
    positions: list[tuple[str, int]] = []
    for name, pattern in SECTION_ANCHORS:
        match = re.search(pattern, page1_text)
        if match:
            positions.append((name, match.start()))

    # Sort by position (they should already be in order, but be safe)
    positions.sort(key=lambda x: x[1])

    sections: dict[str, str] = {}
    for i, (name, start) in enumerate(positions):
        if name == 'DETAIL_END':
            break  # everything after this is payment tables, not needed
        # Section text runs from this anchor to the next anchor's start
        end = positions[i + 1][1] if i + 1 < len(positions) else len(page1_text)
        section_text = page1_text[start:end].strip()
        sections[name] = section_text

    return sections
```

- [ ] **Step 3.4: Run tests**

```bash
python -m pytest test_pdf_parser.py -v
```

Expected: all tests PASS (including the 6 new section tests)

- [ ] **Step 3.5: Commit**

```bash
git add pdf_pattern_learner.py test_pdf_parser.py
git commit -m "feat: pdf learner - section splitter for page 1 contract fields"
```

---

## Task 4: Contract-Level Field Extractors (One Per Section)

Each function receives only its own section text — no cross-section pollution.

**Files:**
- Modify: `pdf_pattern_learner.py` — add `parse_header()`, `parse_pemesan()`, `parse_penyedia()`, `parse_ringkasan_pesanan()`, `parse_ringkasan_pembayaran()`, `parse_payment_summary()`
- Modify: `test_pdf_parser.py` — add field-level tests

- [ ] **Step 4.1: Write failing field tests**

Add to `test_pdf_parser.py`:

```python
from pdf_pattern_learner import (
    extract_pages, split_page1_sections,
    parse_header, parse_pemesan, parse_penyedia,
    parse_ringkasan_pesanan, parse_ringkasan_pembayaran, parse_payment_summary
)

def _get_sections():
    pages = extract_pages(SAMPLE_PDF)
    return split_page1_sections(pages[0])

def test_parse_header_nomor():
    h = parse_header(_get_sections()['HEADER'])
    assert h['nomorKontrak'] == 'EP-01K7N8N66XF1P31F35YXJJ1RFG'

def test_parse_header_tanggal_includes_time():
    h = parse_header(_get_sections()['HEADER'])
    assert h['tanggalKontrak'] == '22 Okt 2025, 00:13:16 WIB'

def test_parse_pemesan_org_name_only():
    p = parse_pemesan(_get_sections()['PEMESAN'])
    assert p['nama'] == 'DIREKTORAT JENDERAL PRASARANA DAN SARANA PERTANIAN'
    # Must NOT include the sub-ministry line
    assert 'Kementerian Pertanian' not in p['nama']

def test_parse_pemesan_pj_and_npwp():
    p = parse_pemesan(_get_sections()['PEMESAN'])
    assert p['pj'] == 'HANDI ARIEF'
    assert p['jabatan'] == 'Pejabat Pembuat Komitmen (PPK)'
    assert p['npwp'] == '00.013.411.4-017.000'

def test_parse_penyedia_includes_umkk():
    p = parse_penyedia(_get_sections()['PENYEDIA'])
    # UMKK is part of the legal name — must be included
    assert p['nama'] == 'KARYA ALFREDO NUSANTARA UMKK'

def test_parse_penyedia_pj_and_npwp():
    p = parse_penyedia(_get_sections()['PENYEDIA'])
    assert p['pj'] == 'ferdy nurmansyah'
    assert p['jabatan'] == 'DIREKTUR'
    assert p['npwp'] == '84.299.005.3-416.000'

def test_parse_ringkasan_pesanan_product_with_unit():
    r = parse_ringkasan_pesanan(_get_sections()['RINGKASAN_PESANAN'])
    assert r['namaProduk'] == 'INSEKTISIDA VISTA 400 SL'
    assert r['kuantitas'] == '11.538,00'
    assert r['satuan'] == 'liter'
    assert r['hargaSatuan'] == 'Rp66.936,00'

def test_parse_ringkasan_pembayaran_total():
    r = parse_ringkasan_pembayaran(_get_sections()['RINGKASAN_PEMBAYARAN'])
    assert r['totalPembayaran'] == 'Rp922.174.200,00'

def test_parse_payment_summary_termin_and_tahap():
    ps = parse_payment_summary(_get_sections()['PAYMENT_SUMMARY'])
    assert ps['jumlahTermin'] == 1
    assert ps['jumlahTahap'] == 2
```

- [ ] **Step 4.2: Run to confirm failure**

```bash
python -m pytest test_pdf_parser.py::test_parse_header_nomor -v
```

Expected: `ImportError: cannot import name 'parse_header'`

- [ ] **Step 4.3: Implement all five section parsers**

Add to `pdf_pattern_learner.py`:

```python
def parse_header(text: str) -> dict:
    """Extract nomorKontrak and tanggalKontrak from HEADER section."""
    nomor = re.search(r'No\.\s*Surat\s*Pesanan\s*:\s*(EP-[A-Z0-9]+)', text)
    tanggal = re.search(
        r'Tanggal\s*Surat\s*Pesanan\s*:\s*(\d{1,2}\s+\w+\s+\d{4},\s*\d{2}:\d{2}:\d{2}\s*WIB)',
        text
    )
    return {
        'nomorKontrak': nomor.group(1).strip() if nomor else None,
        'tanggalKontrak': tanggal.group(1).strip() if tanggal else None,
    }


def parse_pemesan(text: str) -> dict:
    """Extract buyer fields from PEMESAN section."""
    # Org name: between "Pemesan" and "Kementerian Pertanian" (sub-ministry line is excluded)
    # Pattern: after anchor word "Pemesan " up to the newline before "Kementerian"
    org = re.search(r'Pemesan\s+([A-Z][A-Z\s]+?)(?:\s+Kementerian|\s+Nama Penanggung)', text)
    pj = re.search(r'Nama Penanggung Jawab\s*:\s*(.+?)(?:\s+Jabatan|\s+Divisi)', text)
    jabatan = re.search(r'Jabatan Penanggung Jawab\s*:\s*(.+?)(?:\s+Divisi|\s+NPWP)', text)
    divisi = re.search(r'Divisi\s*/\s*Unit Kerja\s*:\s*(.+?)(?:\s+NPWP)', text)
    npwp = re.search(r'NPWP Pemesan\s*:\s*([\d.]+)', text)
    alamat = re.search(r'Alamat Pemesan\s*:\s*(.+?)$', text, re.DOTALL)
    return {
        'nama': org.group(1).strip() if org else None,
        'pj': pj.group(1).strip() if pj else None,
        'jabatan': jabatan.group(1).strip() if jabatan else None,
        'divisi': divisi.group(1).strip() if divisi else None,
        'npwp': npwp.group(1).strip() if npwp else None,
        'alamat': re.sub(r'\s+', ' ', alamat.group(1)).strip() if alamat else None,
    }


def parse_penyedia(text: str) -> dict:
    """Extract supplier fields from PENYEDIA section."""
    # Company name: everything from "Penyedia " up to "Nama Penanggung Jawab"
    # This correctly captures "KARYA ALFREDO NUSANTARA UMKK" including UMKK
    company = re.search(r'Penyedia\s+([A-Z][A-Z\s]+?)\s+Nama Penanggung Jawab', text)
    pj = re.search(r'Nama Penanggung Jawab\s*:\s*(.+?)(?:\s+Jabatan|\s+NPWP)', text)
    jabatan = re.search(r'Jabatan Penanggung Jawab\s*:\s*(.+?)(?:\s+NPWP)', text)
    npwp = re.search(r'NPWP Penyedia\s*:\s*([\d.]+)', text)
    alamat = re.search(r'Alamat Penyedia\s*:\s*(.+?)$', text, re.DOTALL)
    return {
        'nama': company.group(1).strip() if company else None,
        'pj': pj.group(1).strip() if pj else None,
        'jabatan': jabatan.group(1).strip() if jabatan else None,
        'npwp': npwp.group(1).strip() if npwp else None,
        'alamat': re.sub(r'\s+', ' ', alamat.group(1)).strip() if alamat else None,
    }


def parse_ringkasan_pesanan(text: str) -> dict:
    """Extract product name, quantity, unit, and unit price from RINGKASAN_PESANAN section."""
    # Product block pattern: "PDN\n<PRODUCT NAME>\n<qty>,<dec> <unit>"
    product = re.search(
        r'(?:Barang PDN|PDN)\s+(.+?)\s+([\d.]+,\d{2})\s*(liter|kg|gr|botol|Unit|btl|can|sachet|box|Kg)',
        text, re.IGNORECASE
    )
    harga = re.search(r'(Rp[\d.,]+)\s+[\d.,]+\s*(?:https|Golongan|$)', text)
    return {
        'namaProduk': product.group(1).strip() if product else None,
        'kuantitas': product.group(2).strip() if product else None,
        'satuan': product.group(3).strip().lower() if product else None,
        'hargaSatuan': harga.group(1).strip() if harga else None,
    }


def parse_ringkasan_pembayaran(text: str) -> dict:
    """Extract total payment from RINGKASAN_PEMBAYARAN section."""
    total = re.search(r'Estimasi Total Pembayaran\s+(Rp[\d.,]+)', text)
    return {
        'totalPembayaran': total.group(1).strip() if total else None,
    }


def parse_payment_summary(text: str) -> dict:
    """Extract number of payment terms and delivery stages from PAYMENT_SUMMARY section."""
    termin = re.search(r'Pembayaran\s*:\s*(\d+)\s*Termin', text)
    tahap = re.search(r'Pengiriman\s*:\s*(\d+)\s*Tahap', text)
    return {
        'jumlahTermin': int(termin.group(1)) if termin else None,
        'jumlahTahap': int(tahap.group(1)) if tahap else None,
    }
```

- [ ] **Step 4.4: Run all tests**

```bash
python -m pytest test_pdf_parser.py -v
```

Expected: all tests PASS (including all 10 new field tests)

- [ ] **Step 4.5: Commit**

```bash
git add pdf_pattern_learner.py test_pdf_parser.py
git commit -m "feat: pdf learner - section-isolated field extractors for all contract-level fields"
```

---

## Task 5: Delivery Block Extractor (All Pages)

Delivery blocks span all pages after page 1. Each block is a self-contained unit parsed from its own isolated text.

**Files:**
- Modify: `pdf_pattern_learner.py` — add `extract_delivery_blocks()`
- Modify: `test_pdf_parser.py` — add delivery block tests

- [ ] **Step 5.1: Write failing tests**

Add to `test_pdf_parser.py`:

```python
from pdf_pattern_learner import extract_pages, extract_delivery_blocks

def test_delivery_block_count():
    pages = extract_pages(SAMPLE_PDF)
    blocks = extract_delivery_blocks(pages)
    # This 54-page PDF should have many delivery blocks
    assert len(blocks) >= 2, f"Too few blocks: {len(blocks)}"

def test_first_block_fields_complete():
    pages = extract_pages(SAMPLE_PDF)
    blocks = extract_delivery_blocks(pages)
    b = blocks[0]
    assert b['namaPenerima'] == 'Ii Liri'
    assert b['telepon'] == '6285221043186'
    assert 'Pangalengan' in b['alamatLengkap']
    assert b['kabupaten'] == 'Kab. Bandung'
    assert b['provinsi'] == 'Jawa Barat'
    assert b['kodePos'] == '40378'

def test_block_has_quantity_and_costs():
    pages = extract_pages(SAMPLE_PDF)
    blocks = extract_delivery_blocks(pages)
    b = blocks[0]
    assert b['jumlahProduk'] == 6088.0
    assert 'Rp' in b['hargaProdukTotal']
    assert 'Rp' in b['ongkosKirim']

def test_catatan_alamat_extracted_when_present():
    pages = extract_pages(SAMPLE_PDF)
    blocks = extract_delivery_blocks(pages)
    b = blocks[0]
    assert b['catatanAlamat'] is not None
    assert 'TITIK BAGI' in b['catatanAlamat']

def test_permintaan_tiba_extracted():
    pages = extract_pages(SAMPLE_PDF)
    blocks = extract_delivery_blocks(pages)
    b = blocks[0]
    assert b['permintaanTiba'] is not None
    assert '2025' in b['permintaanTiba']
```

- [ ] **Step 5.2: Run to confirm failure**

```bash
python -m pytest test_pdf_parser.py::test_delivery_block_count -v
```

Expected: `ImportError: cannot import name 'extract_delivery_blocks'`

- [ ] **Step 5.3: Implement extract_delivery_blocks**

Add to `pdf_pattern_learner.py`:

```python
def _parse_address(raw: str) -> dict:
    """
    inaproc.id address format:
    "<free text description>, <desa>, <kecamatan>, <Kab/Kota>, <Provinsi>, <kodepos>"
    Split on commas after the first comma to get structured fields.
    """
    parts = [p.strip() for p in raw.split(',')]
    result = {
        'alamatLengkap': raw.strip(),
        'kecamatan': None,
        'kabupaten': None,
        'provinsi': None,
        'kodePos': None,
    }
    if len(parts) >= 2:
        # parts[-1] = kodepos (5 digits)
        # parts[-2] = provinsi
        # parts[-3] = kabupaten/kota
        # parts[-4] = kecamatan
        kodepos_match = re.search(r'\b(\d{5})\b', parts[-1])
        if kodepos_match:
            result['kodePos'] = kodepos_match.group(1)
            if len(parts) >= 4:
                result['kecamatan'] = parts[-4].strip()
            if len(parts) >= 3:
                result['kabupaten'] = parts[-3].strip()
            if len(parts) >= 2:
                result['provinsi'] = parts[-2].strip()
    return result


def extract_delivery_blocks(pages: list[str]) -> list[dict]:
    """
    Scan all pages for Pengiriman blocks.
    Each block starts with 'Pengiriman Nama Penerima :' and ends at the next block start.
    Returns list of parsed delivery block dicts.
    """
    # Join all pages with a page separator marker we can ignore later
    full_text = ' '.join(pages)

    # Split on the delivery block anchor
    # "Pengiriman Nama Penerima" appears before each delivery recipient
    raw_blocks = re.split(r'Pengiriman\s+Nama Penerima\s*:', full_text)

    blocks = []
    for raw in raw_blocks[1:]:  # skip index 0 (text before first block)
        block = raw.strip()

        # Nama Penerima + phone: "Ii Liri (6285221043186)"
        nama_match = re.match(r'^(.+?)\s*\((\d{8,15})\)', block)
        nama = nama_match.group(1).strip() if nama_match else None
        telepon = nama_match.group(2) if nama_match else None

        # Permintaan Tiba
        tiba_match = re.search(
            r'Permintaan Tiba\s*:\s*(.+?)(?:\s+Alamat Pengiriman|\s+Kurir)', block
        )

        # Alamat Pengiriman — up to Catatan or Kurir
        alamat_match = re.search(
            r'Alamat Pengiriman\s*:\s*(.+?)(?:\s+Catatan Alamat|\s+Kurir Pengiriman)', block
        )
        addr_data = _parse_address(alamat_match.group(1)) if alamat_match else {
            'alamatLengkap': None, 'kecamatan': None,
            'kabupaten': None, 'provinsi': None, 'kodePos': None
        }

        # Catatan Alamat — optional field
        catatan_match = re.search(
            r'Catatan Alamat Pengiriman\s*(.+?)(?:\s+Kurir Pengiriman)', block, re.DOTALL
        )
        catatan = re.sub(r'\s+', ' ', catatan_match.group(1)).strip() if catatan_match else None

        # Quantity: from "Harga Produk (6.088,00)"
        qty_match = re.search(r'Harga Produk\s*\(\s*([\d.,]+)\s*\)', block)
        jumlah_raw = qty_match.group(1).replace('.', '').replace(',', '.') if qty_match else None
        jumlah = float(jumlah_raw) if jumlah_raw else None

        # Harga Produk total
        harga_match = re.search(r'Harga Produk\s*\([\d.,]+\)\s*(Rp[\d.,]+)', block)

        # Ongkos Kirim
        ongkos_match = re.search(r'Ongkos Kirim\s*\([\d.,\s]+(?:kg|liter|gr)?\s*\)\s*(Rp[\d.,]+)', block)

        if nama:
            blocks.append({
                'namaPenerima': nama,
                'telepon': telepon,
                'permintaanTiba': tiba_match.group(1).strip() if tiba_match else None,
                **addr_data,
                'catatanAlamat': catatan,
                'jumlahProduk': jumlah,
                'hargaProdukTotal': harga_match.group(1) if harga_match else None,
                'ongkosKirim': ongkos_match.group(1) if ongkos_match else None,
            })

    return blocks
```

- [ ] **Step 5.4: Run all tests**

```bash
python -m pytest test_pdf_parser.py -v
```

Expected: all tests PASS

- [ ] **Step 5.5: Commit**

```bash
git add pdf_pattern_learner.py test_pdf_parser.py
git commit -m "feat: pdf learner - section-isolated delivery block extractor with address parser"
```

---

## Task 6: Full PDF Parser — Assemble Contract Object

Wire all section parsers together into one `parse_pdf()` function.

**Files:**
- Modify: `pdf_pattern_learner.py` — add `parse_pdf()`
- Modify: `test_pdf_parser.py` — add integration test

- [ ] **Step 6.1: Write failing test**

Add to `test_pdf_parser.py`:

```python
from pdf_pattern_learner import parse_pdf

def test_parse_pdf_full_contract():
    contract = parse_pdf(SAMPLE_PDF)
    assert contract['nomorKontrak'] == 'EP-01K7N8N66XF1P31F35YXJJ1RFG'
    assert contract['pemesan']['nama'] == 'DIREKTORAT JENDERAL PRASARANA DAN SARANA PERTANIAN'
    assert contract['penyedia']['nama'] == 'KARYA ALFREDO NUSANTARA UMKK'
    assert contract['produk']['namaProduk'] == 'INSEKTISIDA VISTA 400 SL'
    assert contract['produk']['satuan'] == 'liter'
    assert len(contract['pengiriman']) >= 2
    assert contract['pengiriman'][0]['namaPenerima'] == 'Ii Liri'

def test_parse_pdf_includes_source_file():
    contract = parse_pdf(SAMPLE_PDF)
    assert 'sourceFile' in contract
    assert contract['sourceFile'].endswith('.pdf')
```

- [ ] **Step 6.2: Run to confirm failure**

```bash
python -m pytest test_pdf_parser.py::test_parse_pdf_full_contract -v
```

Expected: `ImportError: cannot import name 'parse_pdf'`

- [ ] **Step 6.3: Implement parse_pdf**

Add to `pdf_pattern_learner.py`:

```python
def parse_pdf(pdf_path: str) -> dict | None:
    """
    Full pipeline: extract pages → split sections → parse all fields.
    Returns a complete contract dict or None if the file cannot be parsed.
    """
    try:
        pages = extract_pages(pdf_path)
    except Exception as e:
        return {'sourceFile': pdf_path, 'error': str(e), 'pengiriman': []}

    if not pages:
        return None

    sections = split_page1_sections(pages[0])

    header = parse_header(sections.get('HEADER', ''))
    pemesan = parse_pemesan(sections.get('PEMESAN', ''))
    payment_summary = parse_payment_summary(sections.get('PAYMENT_SUMMARY', ''))
    penyedia = parse_penyedia(sections.get('PENYEDIA', ''))
    produk = parse_ringkasan_pesanan(sections.get('RINGKASAN_PESANAN', ''))
    pembayaran = parse_ringkasan_pembayaran(sections.get('RINGKASAN_PEMBAYARAN', ''))
    pengiriman = extract_delivery_blocks(pages)

    return {
        'sourceFile': pdf_path,
        **header,
        **payment_summary,
        'pemesan': pemesan,
        'penyedia': penyedia,
        'produk': produk,
        'totalPembayaran': pembayaran.get('totalPembayaran'),
        'pengiriman': pengiriman,
    }
```

- [ ] **Step 6.4: Run all tests**

```bash
python -m pytest test_pdf_parser.py -v
```

Expected: all tests PASS

- [ ] **Step 6.5: Commit**

```bash
git add pdf_pattern_learner.py test_pdf_parser.py
git commit -m "feat: pdf learner - full parse_pdf assembler wiring all section parsers"
```

---

## Task 7: Pattern Learning Pass + JSON Output

Run all PDFs, collect field presence statistics, write both output files.

**Files:**
- Modify: `pdf_pattern_learner.py` — add `build_pattern_report()`, update `__main__`

- [ ] **Step 7.1: Implement build_pattern_report and main**

Replace the `__main__` block in `pdf_pattern_learner.py` with:

```python
def build_pattern_report(contracts: list[dict]) -> dict:
    """
    Analyse field presence and value formats across all parsed contracts.
    Returns a pattern confidence report.
    """
    valid = [c for c in contracts if 'error' not in c]
    total = len(contracts)
    n = len(valid)

    def field_stats(getter, label):
        values = []
        for c in valid:
            try:
                v = getter(c)
            except (KeyError, TypeError):
                v = None
            if v is not None:
                values.append(str(v))
        return {
            'presentIn': len(values),
            'rate': round(len(values) / n, 3) if n else 0,
            'samples': list(dict.fromkeys(values))[:5],  # up to 5 unique samples
        }

    # Delivery block field analysis
    all_blocks = [b for c in valid for b in c.get('pengiriman', [])]
    block_count = len(all_blocks)

    def block_field_stats(key):
        present = sum(1 for b in all_blocks if b.get(key) is not None)
        return {
            'presentInAllBlocks': present == block_count,
            'rate': round(present / block_count, 3) if block_count else 0,
            'samples': list(dict.fromkeys(
                str(b[key]) for b in all_blocks if b.get(key)
            ))[:3],
        }

    block_counts = [len(c.get('pengiriman', [])) for c in valid]

    return {
        'totalPdfs': total,
        'validPdfs': n,
        'skippedFiles': [c['sourceFile'] for c in contracts if 'error' in c],
        'contractFields': {
            'nomorKontrak':    field_stats(lambda c: c.get('nomorKontrak'), 'nomorKontrak'),
            'tanggalKontrak':  field_stats(lambda c: c.get('tanggalKontrak'), 'tanggalKontrak'),
            'jumlahTermin':    field_stats(lambda c: c.get('jumlahTermin'), 'jumlahTermin'),
            'jumlahTahap':     field_stats(lambda c: c.get('jumlahTahap'), 'jumlahTahap'),
            'pemesan.nama':    field_stats(lambda c: c.get('pemesan', {}).get('nama'), 'pemesan.nama'),
            'pemesan.pj':      field_stats(lambda c: c.get('pemesan', {}).get('pj'), 'pemesan.pj'),
            'pemesan.npwp':    field_stats(lambda c: c.get('pemesan', {}).get('npwp'), 'pemesan.npwp'),
            'penyedia.nama':   field_stats(lambda c: c.get('penyedia', {}).get('nama'), 'penyedia.nama'),
            'penyedia.pj':     field_stats(lambda c: c.get('penyedia', {}).get('pj'), 'penyedia.pj'),
            'penyedia.npwp':   field_stats(lambda c: c.get('penyedia', {}).get('npwp'), 'penyedia.npwp'),
            'namaProduk':      field_stats(lambda c: c.get('produk', {}).get('namaProduk'), 'namaProduk'),
            'satuan':          field_stats(lambda c: c.get('produk', {}).get('satuan'), 'satuan'),
            'hargaSatuan':     field_stats(lambda c: c.get('produk', {}).get('hargaSatuan'), 'hargaSatuan'),
            'totalPembayaran': field_stats(lambda c: c.get('totalPembayaran'), 'totalPembayaran'),
        },
        'pengirimanStats': {
            'totalBlocks': block_count,
            'minBlocksPerContract': min(block_counts) if block_counts else 0,
            'maxBlocksPerContract': max(block_counts) if block_counts else 0,
            'avgBlocksPerContract': round(sum(block_counts) / len(block_counts), 1) if block_counts else 0,
            'fields': {
                'namaPenerima':    block_field_stats('namaPenerima'),
                'telepon':         block_field_stats('telepon'),
                'permintaanTiba':  block_field_stats('permintaanTiba'),
                'alamatLengkap':   block_field_stats('alamatLengkap'),
                'kabupaten':       block_field_stats('kabupaten'),
                'provinsi':        block_field_stats('provinsi'),
                'kodePos':         block_field_stats('kodePos'),
                'catatanAlamat':   block_field_stats('catatanAlamat'),
                'jumlahProduk':    block_field_stats('jumlahProduk'),
                'hargaProdukTotal':block_field_stats('hargaProdukTotal'),
                'ongkosKirim':     block_field_stats('ongkosKirim'),
            }
        }
    }


if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Pass 1 — Discovering PDFs...")
    pdfs = discover_pdfs(PDF_ROOT)
    print(f"  Found {len(pdfs)} valid PDFs")

    print("Pass 2+3 — Extracting + pattern learning...")
    contracts = []
    for i, pdf_path in enumerate(pdfs, 1):
        print(f"  [{i}/{len(pdfs)}] {os.path.basename(pdf_path)}", end='\r')
        result = parse_pdf(pdf_path)
        if result:
            contracts.append(result)
    print(f"\n  Parsed {len(contracts)} contracts")

    print("Writing output/parsed_contracts.json...")
    with open(os.path.join(OUTPUT_DIR, 'parsed_contracts.json'), 'w', encoding='utf-8') as f:
        json.dump(contracts, f, ensure_ascii=False, indent=2)

    print("Writing output/pattern_report.json...")
    report = build_pattern_report(contracts)
    with open(os.path.join(OUTPUT_DIR, 'pattern_report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\nDone.")
    print(f"  Contracts parsed: {report['validPdfs']}/{report['totalPdfs']}")
    print(f"  Delivery blocks total: {report['pengirimanStats']['totalBlocks']}")
    if report['skippedFiles']:
        print(f"  Skipped (errors): {len(report['skippedFiles'])}")
        for f in report['skippedFiles']:
            print(f"    - {f}")
```

- [ ] **Step 7.2: Run the full script against all 88 PDFs**

```bash
cd C:\Users\Wyx\bastbanpem
python pdf_pattern_learner.py
```

Expected output:
```
Pass 1 — Discovering PDFs...
  Found 85 valid PDFs     (approx — excludes corrupt xlsx-as-pdf files)
Pass 2+3 — Extracting + pattern learning...
  Parsed 85 contracts
Writing output/parsed_contracts.json...
Writing output/pattern_report.json...

Done.
  Contracts parsed: 85/85
  Delivery blocks total: 350+
```

- [ ] **Step 7.3: Spot-check the pattern report**

```bash
python -c "
import json
with open('output/pattern_report.json') as f:
    r = json.load(f)
print('nomorKontrak rate:', r['contractFields']['nomorKontrak']['rate'])
print('penyedia.nama rate:', r['contractFields']['penyedia.nama']['rate'])
print('namaProduk rate:', r['contractFields']['namaProduk']['rate'])
print('catatanAlamat rate:', r['pengirimanStats']['fields']['catatanAlamat']['rate'])
print('avg blocks/contract:', r['pengirimanStats']['avgBlocksPerContract'])
"
```

Expected: `nomorKontrak rate: 1.0` and `penyedia.nama rate: 1.0`. Any rate below 0.90 means that field's regex needs tuning.

- [ ] **Step 7.4: Commit**

```bash
git add pdf_pattern_learner.py output/
git commit -m "feat: pdf learner - pattern report + full batch run against all PDFs"
```

---

## Task 8: Verify and Review Outputs

- [ ] **Step 8.1: Run the full test suite one final time**

```bash
python -m pytest test_pdf_parser.py -v
```

Expected: all tests PASS, 0 failures

- [ ] **Step 8.2: Open pattern_report.json — check all contract fields**

Any field with `rate < 0.90` needs investigation:
```bash
python -c "
import json
with open('output/pattern_report.json') as f:
    r = json.load(f)
print('=== CONTRACT FIELDS ===')
for field, stats in r['contractFields'].items():
    flag = ' ← INVESTIGATE' if stats['rate'] < 0.90 else ''
    print(f'{field}: {stats[\"rate\"]*100:.0f}%{flag}')
print()
print('=== DELIVERY BLOCK FIELDS ===')
for field, stats in r['pengirimanStats']['fields'].items():
    flag = ' ← INVESTIGATE' if stats['rate'] < 0.80 else ''
    print(f'{field}: {stats[\"rate\"]*100:.0f}%{flag}')
"
```

- [ ] **Step 8.3: Open a parsed contract and verify a delivery block manually**

```bash
python -c "
import json
with open('output/parsed_contracts.json') as f:
    contracts = json.load(f)
c = contracts[0]
print('Contract:', c['nomorKontrak'])
print('Penyedia:', c['penyedia']['nama'])
print('Produk:', c['produk']['namaProduk'], c['produk']['satuan'])
print('Delivery blocks:', len(c['pengiriman']))
print('First block:')
import pprint; pprint.pprint(c['pengiriman'][0])
"
```

- [ ] **Step 8.4: Final commit**

```bash
git add .
git commit -m "docs: pdf pattern learner complete - outputs validated"
```

---

## What the Output Tells Your App

After this script runs, `pattern_report.json` gives you the exact confidence level of every field across all 88 PDFs. You bring those patterns back into `PdfSyncModule.tsx` to replace `handleAutoExtract` with a section-aware version that mirrors this script's logic — using the same anchors, the same field order, the same address parser.

The `parsed_contracts.json` is your ground truth: if the app's parser produces different values than this script for the same PDF, the app's regex is wrong.
