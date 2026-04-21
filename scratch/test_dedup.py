import sys
import os

# Append project root to path
sys.path.append(os.getcwd())

from backend.services.data_engine import canonical_heal, make_unique

def test_mapping():
    print("Testing Canonical Heal (Longest Match Wins)...")
    headers = [
        "Jumlah",                          # Should be QTY
        "Jumlah Total Harga Satuan",       # Should be HARGA SATUAN (longer match)
        "Harga Barang Satuan",            # Should be HARGA SATUAN
        "Pestisida (atau kg)",             # Should be QTY
        "Jumlah total Harga Barang + Jml total Ongkir", # Should be TOTAL_VALUE
        "Unnamed: 0",                      # Should be UNNAMED
    ]
    
    unique_phys = make_unique(headers)
    print(f"Unique Physical: {unique_phys}")
    
    header_map = {}
    seen_headers = {}
    for h in unique_phys:
        canonical = canonical_heal(h)
        if canonical == "UNNAMED":
            header_map[h] = "UNNAMED"
            continue
            
        if canonical in seen_headers:
            seen_headers[canonical] += 1
            header_map[h] = f"{canonical}_{seen_headers[canonical]}"
        else:
            seen_headers[canonical] = 0
            header_map[h] = canonical
            
    for phys, healed in header_map.items():
        print(f"  '{phys}' -> '{healed}'")

if __name__ == "__main__":
    test_mapping()
