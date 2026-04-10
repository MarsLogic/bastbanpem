import pytest
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from pdf_pattern_learner import discover_pdfs, is_valid_pdf

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
