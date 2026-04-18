import fitz
import sys
import os

sys.path.append(os.getcwd())
try:
    from backend.services.pdf_intelligence import PDFIntelligence
except Exception as e:
    print("Error importing", e)

def run():
    pdf = PDFIntelligence()
    doc = fitz.open(r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf")
    tables = pdf.extract_lampiran_tables(doc)
    print(f"Total tables returned: {len(tables)}")
    if tables:
        print(f"Master table headers: {tables[0].get('headers')}")
        print(f"Master table rows count: {len(tables[0].get('rows', []))}")
        if tables[0]['rows']:
            print(f"First row sample: {list(tables[0]['rows'][0].values())[:3]}")
run()
