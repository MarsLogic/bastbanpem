import sys
import os
sys.path.append(os.getcwd())

from backend.services.pdf_intelligence import pdf_intel
import json

def verify_sskk_fidelity(file_path):
    print(f"--- Verifying SSKK Fidelity for {file_path} ---")
    result = pdf_intel.analyze_document(file_path)
    
    sskk_text = result["ultra_robust"].sections.get("SSKK", "NOT FOUND")
    
    print("\n[CLEANED SSKK CONTENT (High-Fidelity)]\n")
    print(sskk_text[:2000] + "...") # First 2000 chars
    
    # Check for specific expected markers
    if "Wakil Sah Para Pihak" in sskk_text or "Wakil Sah Para Pihak" in sskk_text.title():
        print("\n✅ SUCCESS: 'Wakil Sah Para Pihak' found.")
    else:
        print("\n❌ FAILURE: 'Wakil Sah Para Pihak' NOT found or truncated.")
        # Print lines around Clause 2
        lines = sskk_text.split('\n')
        for i, l in enumerate(lines):
            if "Wakil" in l:
                print(f"Detected lines: {lines[i:i+3]}")

    if "Direktorat Pestisida" in sskk_text:
        print("✅ SUCCESS: 'Direktorat Pestisida' (Korespondensi details) found.")
    else:
        print("❌ FAILURE: 'Direktorat Pestisida' NOT found in Korespondensi.")

if __name__ == "__main__":
    verify_sskk_fidelity(r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf")
