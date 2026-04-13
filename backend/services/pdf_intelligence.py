# [DOCS-003] Advanced Pattern Learning for PDFs
import fitz  # PyMuPDF
import polars as pl
import re
from typing import List, Dict, Any, Optional

class PDFIntelligence:
    def __init__(self):
        # Anchor keywords for contract headers
        self.header_anchors = {
            "nomor_kontrak": [r"Nomor\s*[:\-\s]*([A-Z0-9\-\/]+)", r"SPK\s*No\.?\s*([A-Z0-9\-\/]+)"],
            "tanggal_kontrak": [r"Tanggal\s*[:\-\s]*(\d{1,2}\s+\w+\s+\d{4})", r"Dibuat\s+pada\s+tanggal\s*(\d{1,2}\s+\w+\s+\d{4})"],
            "nama_penyedia": [r"Penyedia\s*[:\-\s]*([A-Z\s]+)", r"Pelaksana\s*[:\-\s]*([A-Z\s]+)"],
            "nilai_kontrak": [r"Nilai\s*Kontrak\s*[:\-\s]*Rp\.?\s*([\d\.,]+)", r"Total\s*Biaya\s*[:\-\s]*Rp\.?\s*([\d\.,]+)"]
        }

    def extract_header_data(self, doc: fitz.Document) -> Dict[str, Any]:
        """
        Elite Scan: Looks at the first 3 pages for contract metadata.
        """
        data = {}
        full_text = ""
        for i in range(min(3, len(doc))):
            full_text += doc[i].get_text()

        for key, patterns in self.header_anchors.items():
            for pattern in patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    data[key] = match.group(1).strip()
                    break
        return data

    def extract_lampiran_tables(self, doc: fitz.Document) -> List[Dict[str, Any]]:
        """
        Elite Table Extraction: Uses PyMuPDF's advanced find_tables() logic.
        Specifically looks for rows containing NIKs or names.
        """
        all_tables = []
        
        for page_index, page in enumerate(doc):
            tabs = page.find_tables()
            for tab in tabs:
                df = tab.to_pandas() # PyMuPDF returns pandas-compatible list of lists
                
                # Convert to Polars for "Elite" processing
                try:
                    p_df = pl.from_pandas(df)
                    
                    # Heuristic: Is this a 'Lampiran' data table?
                    # Does it contain a NIK-like column or a 'No' column?
                    cols = [str(c).lower() for c in p_df.columns]
                    is_target = any(k in "".join(cols) for k in ["nik", "nama", "penerima", "qty"])
                    
                    if is_target:
                        all_tables.append({
                            "page": page_index + 1,
                            "headers": p_df.columns,
                            "rows": p_df.to_dicts()
                        })
                except:
                    continue
                    
        return all_tables

    def analyze_document(self, file_path: str) -> Dict[str, Any]:
        """
        Master Entry Point for PDF Intelligence.
        """
        doc = fitz.open(file_path)
        try:
            return {
                "metadata": self.extract_header_data(doc),
                "tables": self.extract_lampiran_tables(doc),
                "total_pages": len(doc)
            }
        finally:
            doc.close()

pdf_intel = PDFIntelligence()
