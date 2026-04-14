# [DOCS-003] Advanced Pattern Learning for PDFs
import fitz  # PyMuPDF
import polars as pl
import re
from typing import List, Dict, Any, Optional

class PDFIntelligence:
    def __init__(self):
        # Anchor keywords for contract headers
        self.header_anchors = {
            "eselon1": [r"Eselon\s*1\s*[:\-\s]*([A-Z\s]+)"],
            "satker": [r"Satker\s*[:\-\s]*([A-Z0-9\s\-]+)"],
            "nomor_dipa": [r"Nomor\s*Dipa\s*[:\-\s]*([A-Z0-9\/\.\-]+)"],
            "nomor_kontrak": [r"No\.\s*Surat\s*Pesanan\s*[:\-\s]*([A-Z0-9\-\/]+)", r"SPK\s*No\.?\s*([A-Z0-9\-\/]+)"],
            "tanggal_kontrak": [r"Tanggal\s*Surat\s*Pesanan\s*[:\-\s]*(\d{1,2}\s+\w+\s+\d{4})", r"(\d{1,2}-\d{1,2}-\d{4})"],
            "nama_penyedia": [r"Penyedia\s*([A-Z\s]+)", r"CV\.\s*([A-Z\s]+)"],
            "nilai_kontrak": [r"Estimasi\s*Total\s*Pembayaran\s*Rp\.?\s*([\d\.,]+)", r"Nilai\s*Kontrak\s*[:\-\s]*Rp\.?\s*([\d\.,]+)"],
            "kegiatan_output_akun": [r"Kegiatan/Output/Akun\s*[:\-\s]*([0-9\.]+)"],
            "vendor_npwp": [r"NPWP\s*Penyedia\s*[:\-\s]*([0-9\.\-]+)"]
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
                    
        # Flag heuristics
        data["is_ongkir_terpisah"] = "ongkir terpisah" in full_text.lower()
        data["is_swakelola"] = "swakelola" in full_text.lower()
        data["is_menggunakan_termin"] = "termin" in full_text.lower()
        
        return data

    def extract_lampiran_tables(self, doc: fitz.Document) -> List[Dict[str, Any]]:
        """
        Elite Table Extraction: Uses PyMuPDF's advanced find_tables() logic.
        Specifically looks for rows containing NIKs or names.
        Fallback: Uses block-based text parsing if structured tables aren't found.
        """
        all_tables = []
        
        for page_index, page in enumerate(doc):
            tabs = page.find_tables()
            if tabs:
                for tab in tabs:
                    df = tab.to_pandas() # PyMuPDF returns pandas-compatible list of lists
                    
                    # Convert to Polars for "Elite" processing
                    try:
                        p_df = pl.from_pandas(df)
                        
                        # Heuristic: Is this a 'Lampiran' data table?
                        # Does it contain a NIK-like column or a 'No' column?
                        cols = [str(c).lower() for c in p_df.columns]
                        is_target = any(k in "".join(cols) for k in ["nik", "nama", "penerima", "qty", "ketua", "kecamatan"])
                        
                        if is_target:
                            all_tables.append({
                                "page": page_index + 1,
                                "headers": p_df.columns,
                                "rows": p_df.to_dicts(),
                                "method": "find_tables"
                            })
                    except:
                        continue
            
            # Fallback for "invisible" tables (only text positioned as a table)
            if not all_tables or all_tables[-1].get("page") != page_index + 1:
                blocks = page.get_text("blocks")
                rows = []
                for b in blocks:
                    text = b[4].strip()
                    # Heuristic for a data row: contains a 16-digit NIK or typical data structure
                    if re.search(r"\d{16}", text):
                        lines = [l.strip() for l in text.split("\n") if l.strip()]
                        # We expect about 10-14 fields for these specific contract tables
                        if len(lines) >= 8:
                            rows.append({
                                "raw_block": text,
                                "fields": lines
                            })
                
                if rows:
                    all_tables.append({
                        "page": page_index + 1,
                        "headers": ["block_data"],
                        "rows": rows,
                        "method": "block_parsing"
                    })
                    
        return all_tables

    def extract_portal_ids(self, html_content: str) -> Dict[str, str]:
        """
        Scrapes essential IDs from the sitemap/portal HTML for the Automation Injector.
        """
        ids = {
            "idkontrak": "",
            "idtermin": "",
            "idbast": ""
        }
        
        # ID Kontrak usually in hidden inputs
        idkontrak_match = re.search(r'name="idkontrak"\s+value="(\d+)"', html_content)
        if idkontrak_match:
            ids["idkontrak"] = idkontrak_match.group(1)
            
        # ID Termin usually in hidden inputs
        idtermin_match = re.search(r'name="idtermin"\s+value="(\d+)"', html_content)
        if idtermin_match:
            ids["idtermin"] = idtermin_match.group(1)
            
        # ID Bast usually in mytable-bast
        idbast_match = re.search(r'name="bp_idbast".*?value="(\d+)"', html_content, re.DOTALL)
        if idbast_match:
            ids["idbast"] = idbast_match.group(1)
            
        return ids

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
