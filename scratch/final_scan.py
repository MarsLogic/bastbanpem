import polars as pl
import fastexcel
import re

def final_col_scan():
    path = r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.xlsx"
    print(f"Reading {path}...")
    try:
        excel = fastexcel.read_excel(path)
        sheet = excel.load_sheet(excel.sheet_names[0], header_row=None)
        df = sheet.to_polars()
        
        row_idx = 0 # Row 0 is the header according to density scan
        print(f"\n--- Header Row Scan (Row {row_idx}) ---")
        for col_idx in range(min(df.width, 35)):
            val = df.row(row_idx)[col_idx]
            print(f"Col {col_idx}: '{val}'")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    final_col_scan()
