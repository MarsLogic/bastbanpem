import pandas as pd
import json

path = r"C:\Users\Wyx\Desktop\KAN\import\Data Penyaluran Kontrak EP-01KA0S0BP15TRA38FKK1BVWEPJ.xlsx"

try:
    # Read the file
    df = pd.read_excel(path, header=None)
    
    # Get basic info
    header_raw = df.iloc[0].tolist() if not df.empty else []
    sample_data = df.iloc[1:5].values.tolist() if len(df) > 1 else []
    
    # Analyze data types for each column
    types = []
    for col in range(len(df.columns)):
        col_data = df.iloc[1:, col].dropna()
        if not col_data.empty:
            types.append(type(col_data.iloc[0]).__name__)
        else:
            types.append("unknown")

    result = {
        "headers": header_raw,
        "sample": sample_data,
        "types": types,
        "shape": df.shape
    }
    
    print(json.dumps(result, indent=2))

except Exception as e:
    print(f"Error: {str(e)}")
