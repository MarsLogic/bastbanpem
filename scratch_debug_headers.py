import fitz

def test_headers():
    doc = fitz.open(r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf")
    for i, page in enumerate(doc):
        tabs = page.find_tables()
        for j, tab in enumerate(tabs):
            df = tab.to_pandas()
            if df.empty: continue
            
            headers = [str(h) for h in df.columns]
            headers_lower = " ".join(headers).lower()
            print(f"Page {i+1} Table {j+1}: cols={len(headers)}")
            print(f"Headers: {headers}")
            print(f"Lower: {headers_lower}")
            print("---")

test_headers()
