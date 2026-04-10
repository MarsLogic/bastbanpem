import pytest
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from pdf_pattern_learner import (
    discover_pdfs, is_valid_pdf, extract_pages, split_page1_sections,
    parse_header, parse_pemesan, parse_penyedia,
    parse_ringkasan_pesanan, parse_ringkasan_pembayaran, parse_payment_summary,
    extract_delivery_blocks, parse_pdf,
)

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


# ── Task 4: Contract-Level Field Extractors ──────────────────────────────────

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
    assert 'Kementerian Pertanian' not in p['nama']

def test_parse_pemesan_pj_and_npwp():
    p = parse_pemesan(_get_sections()['PEMESAN'])
    assert p['pj'] == 'HANDI ARIEF'
    assert p['jabatan'] == 'Pejabat Pembuat Komitmen (PPK)'
    assert p['npwp'] == '00.013.411.4-017.000'

def test_parse_penyedia_includes_umkk():
    p = parse_penyedia(_get_sections()['PENYEDIA'])
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


# ── Task 5: Delivery Block Extractor ────────────────────────────────────────

def test_delivery_block_count():
    pages = extract_pages(SAMPLE_PDF)
    blocks = extract_delivery_blocks(pages)
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


# ── Task 6: Full PDF Parser Assembler ───────────────────────────────────────

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
