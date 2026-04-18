from services.address_parser import address_parser

def test_boutique_cleaning():
    print("\n--- Testing Boutique Address Refinement ---")
    tests = [
        # User Case 1: Extra dots
        "Jl. . Harsono Rm No. 3, Ragunan, Pasar Minggu, Jakarta Selatan",
        "Jl. . Haji Juki No. 114 Paninggilan Utara RT. 02 / RW. 10",
        
        # User Case 2: Hyphenated regional names
        "Ciledug-tangerang",
        
        # User Case 3: Label removal (Kota, Provinsi, etc)
        "Kota: Tangerang. 15153",
        "Provinsi: DKI Jakarta",
        "Kecamatan: Ciledug, Kabupaten: Tangerang",
        
        # Combined Stress Test
        "JlHaji Juki No114 rt/rw 04/08 Ciledug-tangerang. Kota: Tangerang. 15153"
    ]
    for t in tests:
        clean = address_parser.clean_raw(t)
        print(f"Raw:   {t}")
        print(f"Clean: {clean}\n")

def test_postal_healing():
    print("--- Testing Postal Auto-Healing ---")
    prov = "Aceh"
    kab = "Pidie Jaya"
    kec = "Bandar Baru"
    desa = "Abah Lueng"
    healed = address_parser.heal_postal_code(prov, kab, kec, desa, existing="")
    print(f"Expected: 24184 | Got: {healed}")

if __name__ == "__main__":
    test_boutique_cleaning()
    test_postal_healing()
