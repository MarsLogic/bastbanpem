import csv
import json
import os

# Mapping of Province Codes to Canonical Names (Kepmendagri/Standard)
PROV_MAP = {
    "11": "Aceh",
    "12": "Sumatera Utara",
    "13": "Sumatera Barat",
    "14": "Riau",
    "15": "Jambi",
    "16": "Sumatera Selatan",
    "17": "Bengkulu",
    "18": "Lampung",
    "19": "Kepulauan Bangka Belitung",
    "21": "Kepulauan Riau",
    "31": "Daerah Khusus Ibukota Jakarta",
    "32": "Jawa Barat",
    "33": "Jawa Tengah",
    "34": "Daerah Istimewa Yogyakarta",
    "35": "Jawa Timur",
    "36": "Banten",
    "51": "Bali",
    "52": "Nusa Tenggara Barat",
    "53": "Nusa Tenggara Timur",
    "61": "Kalimantan Barat",
    "62": "Kalimantan Tengah",
    "63": "Kalimantan Selatan",
    "64": "Kalimantan Timur",
    "65": "Kalimantan Utara",
    "71": "Sulawesi Utara",
    "72": "Sulawesi Tengah",
    "73": "Sulawesi Selatan",
    "74": "Sulawesi Tenggara",
    "75": "Gorontalo",
    "76": "Sulawesi Barat",
    "81": "Maluku",
    "82": "Maluku Utara",
    "91": "Papua",
    "92": "Papua Barat",
    "93": "Papua Selatan",
    "94": "Papua Tengah",
    "95": "Papua Pegunungan",
    "96": "Papua Barat Daya"
}

def process():
    input_file = "backend/data/postal_codes_raw.csv"
    output_file = "backend/data/kodepos_reference.json"
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    # Structure: { "[PROV]|[KAB]|[KEC]|[DESA]": "POSTAL_CODE" }
    # We use a piped key for fast O(1) exact lookups
    lookup = {}
    
    print("Processing postal codes...")
    with open(input_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            prov_code = row['province_code']
            prov_name = PROV_MAP.get(prov_code, "Unknown")
            
            # Canonicalize keys (lowercase, trim)
            # Use | as separator to avoid comma-in-name issues
            key = f"{prov_name}|{row['city']}|{row['sub_district']}|{row['urban']}".lower()
            lookup[key] = row['postal_code']

    print(f"Mapped {len(lookup)} unique locations.")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(lookup, f, indent=2)
    
    print(f"Saved to {output_file}")

if __name__ == "__main__":
    process()
