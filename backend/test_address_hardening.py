from services.address_parser import address_parser

def test_vibranium_cleaning():
    print("\n--- Testing Vibranium Cleaning ---")
    tests = [
        "JlHarsono No114 rt02rw10 BlokD121",
        "Jalan Haji Juki Nmr. 54 rt/rw 04/08",
        "No. 11, Kel. Sei Penggantungan, Prv. Sumut",
    ]
    for t in tests:
        clean = address_parser.clean_raw(t)
        print(f"Raw:   {t}")
        print(f"Clean: {clean}\n")

def test_postal_healing():
    print("--- Testing Postal Auto-Healing ---")
    # Example from CSV: 1,ABAH LUENG,BANDAR BARU,PIDIE JAYA,11,24184
    # key: aceh|pidie jaya|bandar baru|abah lueng
    prov = "Aceh"
    kab = "Pidie Jaya"
    kec = "Bandar Baru"
    desa = "Abah Lueng"
    
    # Existing code is missing
    healed = address_parser.heal_postal_code(prov, kab, kec, desa, existing="")
    print(f"Triangulating {desa}, {kec}, {kab}, {prov}...")
    print(f"Expected: 24184 | Got: {healed}")
    
    # Existing code is wrong/mangled
    healed_mangled = address_parser.heal_postal_code(prov, kab, kec, desa, existing="00000")
    print(f"Healed from mangled '00000': {healed_mangled}")

if __name__ == "__main__":
    test_vibranium_cleaning()
    test_postal_healing()
