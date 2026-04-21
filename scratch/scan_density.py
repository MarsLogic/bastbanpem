import polars as pl
import fastexcel
import re

def scan_density():
    path = r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.xlsx"
    excel = fastexcel.read_excel(path)
    sheet = excel.load_sheet(excel.sheet_names[0], header_row=None)
    df = sheet.to_polars()
    
    keywords = ["nik", "nama", "penerima", "desa", "jumlah", "qty", "harga", "poktan", "kecamatan", "kabupaten", "provinsi"]
    
    print(f"{'Row':<5} | {'Hits':<5} | {'Sample Values'}")
    print("-" * 60)
    for i in range(10):
        row_vals = [str(x).lower().strip() for x in df.row(i) if x is not None]
        hits = sum(1 for k in keywords if any(k in v for v in row_vals))
        print(f"{i:<5} | {hits:<5} | {str(row_vals[:5])}...")

if __name__ == "__main__":
    scan_density()
