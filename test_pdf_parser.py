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
