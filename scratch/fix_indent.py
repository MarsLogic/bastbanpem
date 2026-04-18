
import os

file_path = 'backend/services/pdf_intelligence.py'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
target_methods = [
    'def extract_sections',
    'def __clean_sskk_layout',
    'def _clean_cell',
    'def _is_positional_header',
    'def _header_quality',
    'def _is_summary_row',
    'def _clean_headers',
    'def _merge_split_columns',
    'def _forward_fill',
    'def _extract_tables_pdfplumber',
    'def _extract_tables_pymupdf',
    'def extract_lampiran_tables',
    'def analyze_document'
]

in_method_block = False
for line in lines:
    stripped = line.lstrip()
    
    # Check if we are starting a method that should be inside the class
    is_method_start = any(stripped.startswith(m) for m in target_methods)
    
    if is_method_start:
        in_method_block = True
        
    # If we are in the block and the line is not indented, indent it!
    # (Excluding already indented lines or empty lines)
    if in_method_block:
        if line.strip() == '':
            new_lines.append(line)
        elif not line.startswith('    ') and not line.startswith('\t'):
            new_lines.append('    ' + line)
        else:
            new_lines.append(line)
    else:
        new_lines.append(line)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.writelines(new_lines)

print("Indentation fix applied.")
