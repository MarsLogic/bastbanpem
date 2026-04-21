import polars as pl
import fastexcel
import re

def full_diagnose():
    path = r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.xlsx"
    print(f"Reading {path}...")
    try:
        excel = fastexcel.read_excel(path)
        sheet = excel.load_sheet(excel.sheet_names[0], header_row=None)
        df = sheet.to_polars()
        
        print("\n--- Physical Column Scan (First 15 Columns) ---")
        for col_idx in range(min(df.width, 35)):
            header_val = df.row(1)[col_idx]
            sample_val = df.row(4)[col_idx]
            print(f"Col {col_idx}: '{header_val}' -> Sample: '{sample_val}'")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    full_diagnose()
