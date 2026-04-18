import sys
import os
sys.path.append(os.getcwd())
import json
from backend.services.pdf_intelligence import pdf_intel

pdf_path = 'C:\\Users\\Wyx\\Desktop\\KAN\\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf'
res = pdf_intel.analyze_document(pdf_path)

print(f"Total tables found: {len(res.get('tables', []))}")
for i, table in enumerate(res.get('tables', [])):
    print(f"\nTable {i}: Page {table.get('page')}")
    print(f"Headers: {table.get('headers')}")
    # Print first row to verify alignment
    if table.get('rows'):
        print(f"First Row: {table['rows'][0]}")
    
    # Search for Spesifikasi Teknis data
    data_str = str(table).lower()
    if 'spesifikasi' in data_str or 'ijin edar' in data_str:
        print(">>> SUCCESS: Found Spesifikasi Teknis data in this table!")
        # Print Ijin Edar specifically
        for row in table.get('rows', []):
            if 'Ijin Edar' in str(row):
                print(f"Ijin Edar Row: {row}")
