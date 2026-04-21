import pandas as pd
path = r"C:\Users\Wyx\Desktop\KAN\import\Data Penyaluran Kontrak EP-01KA0S0BP15TRA38FKK1BVWEPJ.xlsx"

try:
    df = pd.read_excel(path)
    print("Full Headers:", df.columns.tolist())
    print("\nFirst row datatypes:")
    print(df.dtypes)
except Exception as e:
    print(f"Error: {e}")
