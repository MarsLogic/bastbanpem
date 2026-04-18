import fitz
import re

def debug_sskk(file_path):
    print(f"--- Debugging SSKK Extraction for {file_path} ---")
    doc = fitz.open(file_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text()
    
    # Try to find SSKK section
    pattern = r"SYARAT-SYARAT KHUSUS KONTRAK"
    match = re.search(pattern, full_text, re.IGNORECASE)
    if match:
        start = match.start()
        # Find next section or end of doc
        next_pattern = r"Lampiran"
        next_match = re.search(next_pattern, full_text[start:], re.IGNORECASE)
        if next_match:
            sskk_text = full_text[start:start + next_match.start()]
        else:
            sskk_text = full_text[start:]
            
        print("\n[RAW SSKK TEXT]\n")
        print(sskk_text)
    else:
        print("SSKK separator not found in full text.")
    
    doc.close()

if __name__ == "__main__":
    debug_sskk(r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf")
