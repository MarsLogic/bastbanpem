import pdfplumber
import sys
import os
import re

# Add backend to path
sys.path.append(os.getcwd())

from backend.services.pdf_intelligence import PDFIntelligence

pdf_path = r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf"

def test_full_sskk():
    intel = PDFIntelligence()
    output_path = "scratch/sskk_output.txt"
    
    with pdfplumber.open(pdf_path) as pdf:
        with open(output_path, "w", encoding="utf-8") as f:
            found_sskk = False
            for i, page in enumerate(pdf.pages):
                text = page.extract_text(layout=True)
                if "SYARAT-SYARAT KHUSUS KONTRAK" in text:
                    f.write(f"--- SSKK Found on Page {i+1} ---\n")
                    # Try to extract the Korespondensi section
                    refined = intel._refine_sskk_content(text)
                    cleaned = intel._clean_legal_section(refined)
                    f.write(cleaned)
                    f.write("\n")
                    found_sskk = True
                    break
            
            if not found_sskk:
                f.write("SSKK section not found in the entire PDF\n")
    
    print(f"Extraction complete. See {output_path}")

if __name__ == "__main__":
    test_full_sskk()
