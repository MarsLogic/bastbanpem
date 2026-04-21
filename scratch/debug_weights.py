import polars as pl
import fastexcel
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
    "JADWAL": ["jadwal tanam", "masa tanam", "periode tanam", "jadwal", "periode"],
    "NO HP": ["whatsapp", "telepon", "kontak", "phone", "no hp", "no. hp"],
    "LUAS LAHAN": ["luas lahan", "land area", "jumlah luas", "ha"],
    "OPT DOMINAN": ["opt dominan", "opt", "hama", "pest", "kekurangan"],
    "SPESIFIKASI": ["spesifikasi", "merk", "produk", "specification", "brand"],
    "KETUA": ["ketua kelompok", "nama ketua", "ketua"],
    "NOMINAL BAST": ["nominal ditulis di bast", "ditulis di bast", "nominal bast", "jumlah nominal bast"],
    "LOKASI PERTANAMAN": ["lokasi pertanaman", "lokasi tanam", "pertanaman"],
    "SOURCE_IDX": ["ind", "index", "no.", "nomor", "no"],
}

def clean_header_text(text):
    if text is None: return ""
    s = str(text).lower().strip()
    s = re.sub(r'[^\w\s/]', '', s)
    return re.sub(r'\s+', '_', s)

def debug_resolver():
    path = r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.xlsx"
    excel = fastexcel.read_excel(path)
    sheet = excel.load_sheet(excel.sheet_names[0], header_row=None)
    df = sheet.to_polars()
    
    # Simulate data_engine.py header detection
    header_idx = 1 # We'll assume row 2 for now based on previous output
    headers = [clean_header_text(x) for x in df.row(header_idx)]
    
    month_regex = r"(?i)jan|feb|mar|apr|mei|jun|jul|ags|agt|sep|okt|nov|des|uari|ruari|aret|ril|gustus|ptember|tober|vember|sember"

    print(f"{'Col':<5} | {'Raw Header':<20} | {'Clean':<20} | {'Canonical':<15} | {'Weight':<6} | {'Month Hits'}")
    print("-" * 90)
    
    for idx, h in enumerate(headers):
        raw_h = str(df.row(header_idx)[idx])
        best_canonical = None
        best_weight = 0
        
        for canonical, aliases in HEADER_ALIAS_MAP.items():
            for alias in aliases:
                is_match = False
                if len(alias) <= 5:
                    if re.search(fr"\b{re.escape(alias)}\b", h): is_match = True
                elif alias in h.replace('_', ' '): # Fix attempt 1: Replace underscore with space
                    is_match = True
                
                if is_match:
                    weight = len(alias)
                    if alias == h.replace('_', ' '): weight += 50
                    if weight > best_weight:
                        best_weight = weight
                        best_canonical = canonical
        
        month_hits = 0
        if best_canonical == "JADWAL" or "jadwal" in h or "tanam" in h:
            try:
                series = df.select(pl.col(df.columns[idx])).slice(header_idx+1, 50).to_series().cast(pl.Utf8)
                month_hits = series.str.contains(month_regex).sum()
            except: pass

        print(f"{idx:<5} | {raw_h[:20]:<20} | {h[:20]:<20} | {str(best_canonical):<15} | {best_weight:<6} | {month_hits}")

if __name__ == "__main__":
    debug_resolver()
