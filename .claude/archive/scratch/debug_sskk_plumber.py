import pdfplumber

def debug_sskk_plumber(file_path):
    print(f"--- Debugging SSKK with pdfplumber for {file_path} ---")
    with pdfplumber.open(file_path) as pdf:
        # We know SSKK starts around page 7
        for i in range(6, 10):
            if i >= len(pdf.pages): break
            page = pdf.pages[i]
            text = page.extract_text(layout=True)
            print(f"\n--- PAGE {i+1} ---\n")
            print(text)

if __name__ == "__main__":
    debug_sskk_plumber(r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf")
