from services.address_parser import address_parser

def test_deduplication():
    print("\n--- Testing Address Deduplication & Label Removal ---")
    tests = [
        # User Case 1: Redundant regional info
        "Jl. Harsono Rm No. 3, Ragunan, Pasar Minggu, Jakarta Selatan, Desa: Pasar Minggu, Kecamatan: Pasar Minggu, Kabupaten: Administrasi Jakarta Selatan, Provinsi: Daerah Khusus Ibukota Jakarta",
        
        # User Case 2: Label removal
        "Jl. Haji Juki No. 114 Paninggilan Utara RT. 02 / RW. 10 Ciledug Tangerang. Tangerang. 15153, Desa: Paninggilan, Kecamatan: Ciledug, Kabupaten: Tangerang, Provinsi: Banten",
        
        # Mixed tokens
        "Pasar Minggu, Kota Pasar Minggu, Kec: Pasar Minggu",
        
        # Hyphens in regions
        "Ciledug-tangerang, Kabupaten: Tangerang"
    ]
    for t in tests:
        clean = address_parser.clean_raw(t)
        print(f"Raw:   {t}")
        print(f"Clean: {clean}\n")

if __name__ == "__main__":
    test_deduplication()
