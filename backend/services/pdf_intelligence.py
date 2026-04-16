# [DOCS-003] Advanced Pattern Learning for PDFs
import fitz  # PyMuPDF
import polars as pl
import re
from typing import List, Dict, Any, Optional
from backend.services.address_parser import address_parser

class PDFIntelligence:
    def __init__(self):
        # [DOCS-003] Validated against real Surat Pesanan INAPROC PDFs
        # All patterns tested against EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf
        self.header_anchors = {
            # Contract number — exact newline structure from INAPROC export
            "nomor_kontrak":   r"No\.\s*Surat\s*Pesanan\n:\s*([A-Z0-9][A-Z0-9\-]+)",
            # Date — take only the date part, not timestamp
            "tanggal_kontrak": r"Tanggal\s*Surat\s*Pesanan\n:\s*(\d{1,2}\s+\w+\s+\d{4})",
            # Purchaser org is on the line immediately after "Pemesan\n"
            "nama_pemesan":    r"Pemesan\n([A-Z][^\n]+)\nKementerian",
            # PPK = first "Nama Penanggung Jawab" whose jabatan is PPK
            "nama_ppk":        r"Nama Penanggung Jawab\n:\s*([^\n]+)\nJabatan Penanggung Jawab\n:\s*Pejabat Pembuat Komitmen",
            # NPWP sections are labelled distinctly
            "npwp_pemesan":    r"NPWP Pemesan\n:\s*([0-9\.\-]+)",
            # Vendor name — line after "Penyedia\n"; handles UMKK and non-UMKK vendors
            "nama_penyedia":   r"Penyedia\n([A-Z][^\n]+)\n(?:UMKK|Nama Penanggung)",
            "npwp_penyedia":   r"NPWP Penyedia\n:\s*([0-9\.\-]+)",
            # Product = line after "Barang\nPDN\n" in Ringkasan Pesanan
            "nama_produk":     r"Barang\nPDN\n([^\n]+)",
            # Unit price = Rp value after PPN label, before the quantity line
            "harga_satuan":    r"Golongan PPN[^\n]*\nRp([\d\.,]+)\n",
            # Total quantity from "X liter" in Ringkasan Pesanan
            "total_kuantitas": r"([\d\.,]+)\s*liter",
            # Total payment
            "nilai_kontrak":   r"Estimasi Total Pembayaran\nRp([\d\.,]+)",
            # Number of delivery stages
            "jumlah_tahap":    r"Pengiriman\n:\s*(\d+)\s*Tahap",
            # Legacy/other contract types
            "nomor_dipa":          r"Nomor\s*Dipa\s*[:\-\s]*([A-Z0-9\/\.\-]+)",
            "kegiatan_output_akun": r"Kegiatan/Output/Akun\s*[:\-\s]*([0-9\.]+)",
        }

    def _parse_address(self, addr_raw: str) -> Dict[str, str]:
        """Delegate to the dedicated InaprocAddressParser [DOCS-004]."""
        return address_parser.parse(addr_raw)

    def extract_header_data(self, doc: fitz.Document) -> Dict[str, Any]:
        """
        Elite Scan: Scans first 3 pages for all 12 contract header fields.
        Patterns validated against INAPROC Surat Pesanan export format.
        """
        data = {}
        full_text = ""
        for i in range(min(3, len(doc))):
            full_text += doc[i].get_text()

        for key, pattern in self.header_anchors.items():
            m = re.search(pattern, full_text)
            if m:
                data[key] = m.group(1).strip()

        # Flag heuristics
        data["is_ongkir_terpisah"] = "ongkir terpisah" in full_text.lower()
        data["is_swakelola"]       = "swakelola" in full_text.lower()
        data["is_menggunakan_termin"] = "termin" in full_text.lower()

        return data

    def extract_delivery_blocks(self, doc: fitz.Document) -> List[Dict[str, Any]]:
        """
        Extract all delivery/pengiriman blocks from Surat Pesanan PDF.
        Each block = one recipient with full address, quantity, pricing.
        Handles multi-page documents (INAPROC exports can be 32+ pages).
        """
        full_text = ""
        for page in doc:
            full_text += page.get_text()

        # Split on each "Nama Penerima" header — each is one delivery block
        sections = re.split(r'(?=Nama Penerima\s*\n:\s*)', full_text)
        blocks = []

        for section in sections[1:]:  # sections[0] is header before first block
            block: Dict[str, Any] = {}

            # Name + phone
            m = re.match(r'Nama Penerima\s*\n:\s*(.+?)\s*\((\d+)\)', section)
            if not m:
                continue
            block["nama_penerima"] = m.group(1).strip()
            block["no_telp"]       = m.group(2).strip()

            # Delivery date range
            m = re.search(r'Permintaan Tiba\s*\n:\s*(.+)', section)
            if m:
                block["permintaan_tiba"] = m.group(1).strip()

            # Address block — ends at "Catatan Alamat"
            m = re.search(
                r'Alamat Pengiriman\s*\n:\s*(.+?)\nCatatan Alamat',
                section, re.DOTALL
            )
            if m:
                block.update(self._parse_address(m.group(1)))

            # Quantity (first number after product name line)
            m = re.search(r'INSEKTISIDA[^\n]*\n([\d\.,]+)\n', section)
            if not m:
                # Generic product line — any product name capitalised
                m = re.search(r'(?:PDN|Barang)[^\n]*\n([A-Z][^\n]+)\n([\d\.,]+)\n', section)
                if m:
                    block["jumlah"] = m.group(2).strip()
            else:
                block["jumlah"] = m.group(1).strip()

            # Product line total
            m = re.search(r'Harga Produk \([\d\.,]+\)\nRp([\d\.,]+)', section)
            if m:
                block["harga_produk_total"] = f"Rp{m.group(1).strip()}"

            # Shipping cost
            m = re.search(r'Ongkos Kirim \([\d\.,]+ kg\)\nRp([\d\.,]+)', section)
            if m:
                block["ongkos_kirim"] = f"Rp{m.group(1).strip()}"

            blocks.append(block)

        return blocks

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
        Returns header metadata, delivery blocks, lampiran tables, and page count.
        """
        doc = fitz.open(file_path)
        try:
            return {
                "metadata":        self.extract_header_data(doc),
                "delivery_blocks": self.extract_delivery_blocks(doc),
                "tables":          self.extract_lampiran_tables(doc),
                "total_pages":     len(doc)
            }
        finally:
            doc.close()

pdf_intel = PDFIntelligence()
