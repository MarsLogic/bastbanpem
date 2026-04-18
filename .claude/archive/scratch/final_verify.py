
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
    if table.get('rows'):
        print(f"Row count: {len(table['rows'])}")
        try:
            print(f"First Row: {table['rows'][0]}")
        except UnicodeEncodeError:
            print(f"First Row: {str(table['rows'][0]).encode('ascii', 'ignore').decode()}")

sskk = res['ultra_robust'].sections.get('SSKK', '')
if sskk:
    print("\n--- SSKK Verification ---")
    if '4. Jangka Waktu Pelaksanaan Pekerjaan' in sskk:
        print("SUCCESS: Section 4 Title Reconciled!")
    else:
        # Print a snippet to see what happened
        idx = sskk.find('4. Jangka Waktu')
        if idx != -1:
             print(f"FAILURE: Section 4 found but mismatched. Snippet: {sskk[idx:idx+80]!r}")
        else:
             print("FAILURE: Section 4 not found at all!")
             
    if 'Bantuan Pestisida Apbn Tahun' in sskk:
        print("SUCCESS: Section 6 Title Case applied!")
    elif 'BANTUAN PESTISIDA' in sskk:
        print("FAILURE: Section 6 still in caps.")
    else:
        print("FAILURE: Section 6 text block not found.")
