import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.services.pdf_intelligence import PDFIntelligence

pdf_intel = PDFIntelligence()

print("--- TESTING _format_text_professional EDGE CASES ---")
edge_cases_format = [
    "PT. MITRA JAYA MANTAP", # Punctuation near acronym
    "PEMBAYARAN MENGGUNAKAN PPN 11% DAN PPH 22", # Includes numbers and PPN
    "KONTRAK DOKUMEN SSKK DAN SSUK (LAMPIRAN I)", # Parentheses and multiple acronyms
    "ALAMAT: JL. JEND. SUDIRMAN NO. 123", # Abbreviations
    "NAMA PERUSAHAAN: CV. BINTANG MAKMUR SEJAHTERA", # CV acronym
    "MOHON LAMPIRKAN FOTOKOPI KTP DAN NPWP PENANGGUNG JAWAB", # Multiple acronyms
]

for text in edge_cases_format:
    print(f"Original : {text}")
    print(f"Formatted: {pdf_intel._format_text_professional(text)}\n")

print("--- TESTING __clean_sskk_layout EDGE CASES ---")
# Edge case: no gaps, random gaps, bullets, single column, headers mixed in
sskk_edge_case_text = """
1. Judul Klausal
    Nilai ini agak masuk ke dalam.
2. Klausal Kedua               Ternyata ada gap besar disini untuk value.
3. Klausal Ketiga              • Ini adalah bullet pertama
                               • Ini bullet kedua
                               • Ini bullet ketiga dengan teks yang
                                 sangat panjang ke bawah.
Halaman 1/12
#EP-1293810
    Tiba-tiba ada text menggantung di luar value.
"""

cleaned_sskk = pdf_intel._PDFIntelligence__clean_sskk_layout(sskk_edge_case_text)
print("Cleaned SSKK Layout output:\n")
print(cleaned_sskk)
print("\n")

print("--- TESTING PPN RATE EDGE CASES ---")
# Assume we have full_text with weird tax strings
tax_edge_case_1 = "Total PPN Rp 1.000.000 dengan tarif 12%"
tax_edge_case_2 = "Diskon 12% pada barang, Pajak Pertambahan Nilai Rp 100.000 (11%)"

import re
def test_ppn(text):
    ppn_rate = 0.11
    tax_section = re.search(r'(?:Total\s+PPN|Pajak\s+Pertambahan\s+Nilai|PPN)[\s\S]{0,250}?Rp\s*([\d\.,]+)', text, re.IGNORECASE)
    if tax_section:
        tax_context = tax_section.group(0)
        if "12%" in tax_context:
            ppn_rate = 0.12
        elif "11%" in tax_context:
            ppn_rate = 0.11
    return ppn_rate

print(f"Tax Case 1 (Expect 0.12) -> {test_ppn(tax_edge_case_1)}")
print(f"Tax Case 2 (Expect 0.11) -> {test_ppn(tax_edge_case_2)}")

