import json
import re
import os

def clean_value(v):
    if v is None: return ""
    v = str(v).strip()
    # Remove things like "( 25)" -> "25"
    v = re.sub(r"[\(\)]", "", v).strip()
    return v

def process_block_fields(fields, filename):
    row_data = {
        "file_source": filename,
        "kabupaten": "",
        "kecamatan": "",
        "desa": "",
        "poktan": "",
        "ketua": "",
        "nik": "",
        "hp": "",
        "lokasi": "",
        "luas": "",
        "qty": "",
        "spesifikasi": "",
        "jadwal": "",
        "koordinat": ""
    }
    
    # Heuristics for mapping
    # NIK is always 16 digits
    # HP usually starts with 08 or 8
    # Luas/Qty are numbers
    
    nik_found = False
    hp_found = False
    
    # Common words to ignore or help classification
    locations = ["cianjur", "ciamis", "garut", "pesawaran", "lampung"]
    
    temp_fields = [f for f in fields if f.strip() not in ["(", ")", "Ha", "l", "kg"]]
    
    # Try to find NIK first as it's the anchor
    nik_idx = -1
    for i, f in enumerate(temp_fields):
        if re.search(r"\d{16}", f):
            row_data["nik"] = re.search(r"\d{16}", f).group(0)
            nik_idx = i
            nik_found = True
            break
            
    if not nik_found:
        return None # Skip if no NIK

    # Fields before NIK: Usually [No], [Kab], [Kec], [Desa], [Poktan], [Ketua]
    # In some files, No or Kab might be missing per row if they are merged in PDF
    before_nik = temp_fields[:nik_idx]
    if len(before_nik) >= 4:
        # Reverse mapping: Ketua is right before NIK
        row_data["ketua"] = before_nik[-1]
        row_data["poktan"] = before_nik[-2]
        row_data["desa"] = before_nik[-3]
        row_data["kecamatan"] = before_nik[-4]
        if len(before_nik) >= 5:
            row_data["kabupaten"] = before_nik[-5]
    elif len(before_nik) == 3:
        row_data["ketua"] = before_nik[-1]
        row_data["poktan"] = before_nik[-2]
        row_data["desa"] = before_nik[-3]
    elif len(before_nik) == 2:
        row_data["ketua"] = before_nik[-1]
        row_data["poktan"] = before_nik[-2]

    # Fields after NIK: Usually [HP], [Lokasi], [Luas], [Qty], [Spec], [Jadwal], [Koord]
    after_nik = temp_fields[nik_idx+1:]
    
    # HP is usually first after NIK
    if len(after_nik) > 0:
        if re.search(r"^08|^\+62|^8\d{8}", after_nik[0]):
            row_data["hp"] = after_nik[0]
            after_nik = after_nik[1:]
            
    # Location usually "Non Kehutananan"
    if len(after_nik) > 0 and "kehutanan" in after_nik[0].lower():
        row_data["lokasi"] = after_nik[0]
        after_nik = after_nik[1:]
        
    # Luas and Qty are next
    if len(after_nik) >= 2:
        row_data["luas"] = clean_value(after_nik[0])
        row_data["qty"] = clean_value(after_nik[1])
        after_nik = after_nik[2:]
    elif len(after_nik) == 1:
        row_data["luas"] = clean_value(after_nik[0])
        after_nik = after_nik[1:]
        
    # Spec
    if len(after_nik) > 0:
        if any(s in after_nik[0].lower() for s in ["insektisida", "fungisida", "pestisida"]):
            row_data["spesifikasi"] = after_nik[0]
            after_nik = after_nik[1:]
            
    # Jadwal
    if len(after_nik) > 0 and after_nik[0] == "-":
        row_data["jadwal"] = after_nik[0]
        after_nik = after_nik[1:]
        
    # Coordinate is usually the last one
    if len(after_nik) > 0:
        row_data["koordinat"] = after_nik[-1]
        
    return row_data

def process_table_rows(rows, filename):
    results = []
    # Identify column mapping from headers/first row
    # In find_tables, the headers might be in the 'headers' or the first row of 'rows'
    
    # For these specific PDFs, the column order in 737 Gabung.pdf (find_tables) was:
    # No, Kabupaten, Kecamatan, Desa, Poktan, Ketua, NIK, HP, Lokasi, Luas, Qty, Spec, Jadwal, Koord
    
    for row in rows:
        # Skip header-like rows
        if "NIK" in str(row.values()): continue
        if not any(re.search(r"\d{16}", str(v)) for v in row.values()): continue
        
        vals = list(row.values())
        # Filter out the long header text if it's used as a key
        vals = [v for v in vals if v is not None]
        
        # This is tricky because headers are keys. 
        # Better to convert to a list of values and use heuristics like block parsing.
        row_data = process_block_fields(vals, filename)
        if row_data:
            results.append(row_data)
            
    return results

def main():
    with open('output/extracted_pdf_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    final_beneficiaries = []
    
    for filename, content in data.items():
        print(f"Processing {filename}...")
        
        # Propagation state
        last_kab = ""
        last_kec = ""
        last_desa = ""
        
        for table in content.get('tables', []):
            table_beneficiaries = []
            if table.get('method') == 'find_tables':
                table_beneficiaries.extend(process_table_rows(table.get('rows', []), filename))
            elif table.get('method') == 'block_parsing':
                for row_block in table.get('rows', []):
                    processed = process_block_fields(row_block.get('fields', []), filename)
                    if processed:
                        table_beneficiaries.append(processed)
            
            # Propagate values
            for b in table_beneficiaries:
                if b['kabupaten']: last_kab = b['kabupaten']
                else: b['kabupaten'] = last_kab
                
                if b['kecamatan']: last_kec = b['kecamatan']
                else: b['kecamatan'] = last_kec
                
                if b['desa']: last_desa = b['desa']
                else: b['desa'] = last_desa
                
            final_beneficiaries.extend(table_beneficiaries)
                        
    # Deduplicate by NIK
    seen_niks = set()
    unique_beneficiaries = []
    for b in final_beneficiaries:
        if b['nik'] not in seen_niks:
            unique_beneficiaries.append(b)
            seen_niks.add(b['nik'])
            
    output_file = 'output/final_beneficiaries.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(unique_beneficiaries, f, indent=2, ensure_ascii=False)
        
    print(f"Processed {len(unique_beneficiaries)} unique beneficiaries. Saved to {output_file}")

if __name__ == "__main__":
    main()
