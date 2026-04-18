import fitz
import sys

def get_sskk(pdf_path):
    doc = fitz.open(pdf_path)
    found_sskk = False
    for i, page in enumerate(doc):
        text = page.get_text()
        if "SYARAT-SYARAT KHUSUS KONTRAK" in text or found_sskk:
            found_sskk = True
            print(f"--- PAGE {i} ---")
            lines = text.split("\n")
            for j, line in enumerate(lines):
                if "3. Pengalihan" in line or "4. Jangka" in line:
                    start_idx = max(0, j - 2)
                    end_idx = min(len(lines), j + 15)
                    print("\n".join(lines[start_idx:end_idx]))
            
if __name__ == "__main__":
    get_sskk(r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf")
