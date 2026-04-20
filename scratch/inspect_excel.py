import polars as pl
import fastexcel
import json
import sys

def inspect_excel(path):
    print(f"Inspecting: {path}")
    excel = fastexcel.read_excel(path)
    
    info = {
        "sheets": excel.sheet_names,
        "first_sheet_preview": {}
    }
    
    first_sheet = excel.sheet_names[0]
    df = excel.load_sheet(first_sheet).to_polars()
    
    # We want to identify the REAL header.
    # We'll dump the first 10 rows.
    head_rows = df.head(20).to_dicts()
    
    # Convert all values to string to be JSON serializable
    clean_rows = []
    for row in head_rows:
        clean_row = {str(k): str(v) for k, v in row.items()}
        clean_rows.append(clean_row)
        
    info["first_sheet_preview"]["columns"] = df.columns
    info["first_sheet_preview"]["rows"] = clean_rows
    
    with open("scratch/excel_inspection.json", "w", encoding="utf-8") as f:
        json.dump(info, f, indent=2, ensure_ascii=False)
        
    print("Inspection complete. See scratch/excel_inspection.json")

if __name__ == "__main__":
    inspect_excel(r'C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.xlsx')
