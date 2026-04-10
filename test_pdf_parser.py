import pytest
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from pdf_pattern_learner import discover_pdfs, is_valid_pdf, extract_pages, split_page1_sections

PDF_ROOT = r"C:\Users\Wyx\Desktop\Project 2026"

def test_discovers_at_least_80_pdfs():
    paths = discover_pdfs(PDF_ROOT)
    assert len(paths) >= 80, f"Expected 80+ PDFs, got {len(paths)}"

def test_is_valid_pdf_rejects_xlsx_magic_bytes(tmp_path):
    fake = tmp_path / "tricky.pdf"
    fake.write_bytes(b'PK\x03\x04' + b'\x00' * 100)  # xlsx magic bytes
    assert not is_valid_pdf(str(fake))

def test_is_valid_pdf_accepts_pdf_magic_bytes(tmp_path):
    real = tmp_path / "real.pdf"
    real.write_bytes(b'%PDF-1.4 ...')
    assert is_valid_pdf(str(real))

def test_all_discovered_paths_end_with_pdf():
    paths = discover_pdfs(PDF_ROOT)
    for p in paths:
        assert p.lower().endswith('.pdf'), f"Non-PDF path found: {p}"


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
    assert "Nama Penerima" in pages[1]


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
    assert "KARYA ALFREDO" not in sections['PEMESAN']
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

def test_split_handles_missing_anchor_gracefully():
    # If DETAIL_END sentinel is absent, other sections still extract
    mock_text = (
        "Surat Pesanan No. Surat Pesanan : EP-TEST "
        "Pemesan KEMENTERIAN TEST Nama Penanggung Jawab : TEST "
        "Informasi Pembayaran dan Pengiriman Pembayaran : 1 Termin "
        "Penyedia PERUSAHAAN TEST Nama Penanggung Jawab : DIREKTUR "
        "Ringkasan Pesanan Melalui Negosiasi PDN PRODUK TEST 1,00 liter "
        "Ringkasan Pembayaran Estimasi Total Pembayaran Rp1.000,00"
        # Note: no 'Detail Informasi Pembayaran' sentinel
    )
    sections = split_page1_sections(mock_text)
    assert 'HEADER' in sections
    assert 'PEMESAN' in sections
    assert 'PENYEDIA' in sections
    assert 'RINGKASAN_PESANAN' in sections
    assert 'RINGKASAN_PEMBAYARAN' in sections
