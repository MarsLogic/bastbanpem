import polars as pl
import re

HEADER_ALIAS_MAP = {
    "PROVINSI": ["provinsi", "p r o v", "prov", "insi"],
    "KABUPATEN": ["kabupaten", "kota", "k a b", "kab"],
    "KECAMATAN": ["kecamatan", "k e c", "kec"],
    "DESA/KEL": ["desa/kel", "kelurahan", "village", "desa", "kel"],
    "NIK": ["nik", "nomor induk kependudukan", "identity", "ktp", "no. ktp", "no ktp", "nomor", "id"],
    "NAMA PENERIMA": ["nama penerima", "nama petani", "ketua kelompok", "calon penerima", "nama ketua", "penerima", "petani", "penerima manfaat", "nama"],
    "QTY": ["volume barang", "volume", "kuantitas", "liter", "kg", "unit", "banyaknya", "jumlah volume", "pestisida", "qty"],
    "HARGA SATUAN": ["harga barang satuan", "harga satuan", "unit price", "harga barang", "satuan"],
    "ONGKOS KIRIM": ["ongkos kirim satuan", "ongkos kirim", "ongkir", "shipping", "biaya kirim", "jasa kirim"],
    "TOTAL_VALUE": ["jumlah total harga barang + jml total ongkir", "jumlah total harga", "total value", "nominal", "target", "pagu", "total bayar", "total nominal", "jumlah nominal"],
    "POKTAN/GROUP": ["kelompok tani", "gapoktan", "poktan", "group", "lmdh", "koperasi", "kth", "brigade"],
    "JADWAL": ["masa tanam", "jadwal tanam", "jadwal", "tanam", "periode"],
    "NO HP": ["whatsapp", "telepon", "kontak", "phone", "no hp", "no. hp"],
    "LUAS LAHAN": ["luas lahan", "land area", "jumlah luas", "ha"],
    "OPT DOMINAN": ["opt dominan", "opt", "hama", "pest", "kekurangan"],
    "SPESIFIKASI": ["spesifikasi", "merk", "produk", "specification", "brand"],
    "KETUA": ["ketua kelompok", "nama ketua", "ketua"],
}

def canonical_heal(raw_header: str) -> str:
    if not raw_header: return "UNNAMED"
    clean = str(raw_header).lower().strip()
    if "unnamed" in clean or clean.startswith("column_") or len(clean) < 2:
        return "UNNAMED"
    
    best_canonical = None
    best_match_len = 0
    for canonical, aliases in HEADER_ALIAS_MAP.items():
        for alias in aliases:
            if alias in clean:
                weight = len(alias)
                if weight > best_match_len:
                    best_match_len = weight
                    best_canonical = canonical
    return best_canonical or "RAW_" + clean.upper()

# Test the headers from the screenshot
headers = [
    "No", "Kabupaten", "Kecamatan", "Desa", "Poktan/Gapoktan/LMDH/Koperasi/KTH/BPTPH/Brigade Pangan",
    "Ketua", "NIK", "No HP", "Lokasi Pertanaman (Ha)", "Luas Lahan (Ha)", "Pestisida (Liter atau kg)",
    "Spesifikasi Bantuan", "OPT Dominan", "Jadwal Tanam"
]

print("Header Mapping Analysis:")
seen_count = {}
resolver = {}
for h in headers:
    canonical = canonical_heal(h)
    print(f"Original: '{h}' -> Canonical: {canonical}")
    if canonical not in resolver:
        resolver[canonical] = h
    
    if canonical in seen_count:
        seen_count[canonical] += 1
        healed = f"{canonical}_{seen_count[canonical]}"
    else:
        seen_count[canonical] = 0
        healed = canonical
    print(f"  Healed: {healed}")

print("\nResolver Map:")
for k, v in resolver.items():
    print(f"  {k}: {v}")
