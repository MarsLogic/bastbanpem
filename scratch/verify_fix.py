import polars as pl
import os
import sys

# Add backend to path
sys.path.append(os.getcwd())

from backend.services.data_engine import ingest_excel_to_models, EliteJadwalHealer

def verify():
    path = r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.xlsx"
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return

    print(f"Running verification on {path}...")
    with open(path, "rb") as f:
        content = f.read()
    
    try:
        result = ingest_excel_to_models(content)
        print(f"\nFinal UI Headers: {result.headers}")
        
        # Check first 5 rows for Jadwal
        print("\nVerification Samples (First 5 Rows):")
        for i, row in enumerate(result.rows[:5]):
            # Find the header mapped to JADWAL
            jadwal_val = row.jadwal_tanam
            print(f"Row {i}: NAMA={row.name}, JADWAL={jadwal_val}")
            
            # Check column_data too
            col_data_jadwal = row.column_data.get("JADWAL")
            print(f"  Column Data JADWAL: {col_data_jadwal}")

        # Targeted Check for okmar/apr-sep if present in the data
        found_range = False
        for row in result.rows:
            if " - " in str(row.jadwal_tanam):
                print(f"\nFound Range Match: {row.jadwal_tanam}")
                found_range = True
                break
        
        if not found_range:
            print("\nNote: No date ranges detected in the first sheet sample.")

    except Exception as e:
        print(f"Error during ingestion: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify()
