import fitz  # PyMuPDF
import re
import datetime
import json
from typing import List, Dict, Any, Optional
from backend.services.address_parser import address_parser
from backend.models import (
    UltraRobustContract, ContractHeader, Financials, FinancialTaxLogic,
    BankDisbursement, ComplianceFlags, ShipmentLedgerItem, ShipmentRecipient,
    ShipmentDestination, ShipmentCosts, ContractMetadata
)

class PDFIntelligence:
    SECTION_ANCHORS = {
        "HEADER": r"Surat Pesanan",
        "PEMESAN": r"Pemesan\n",
        "PENYEDIA": r"Penyedia\n",
        "RINGKASAN_PESANAN": r"Ringkasan Pesanan",
        "RINGKASAN_PEMBAYARAN": r"Ringkasan Pembayaran",
        "SSUK": r"SYARAT-SYARAT UMUM KONTRAK",
        "SSKK": r"SYARAT-SYARAT KHUSUS KONTRAK",
        "LAMPIRAN": r"Lampiran"
    }

    def __init__(self):
        # Patterns for Ultra-Robust Extraction
        self.patterns = {
            "order_id": r"No\.\s*Surat\s*Pesanan\n:\s*([A-Z0-9][A-Z0-9\-]+)",
            "timestamp": r"Tanggal\s*Surat\s*Pesanan\n:\s*(\d{1,2}\s+\w+\s+\d{4},\s*\d{2}:\d{2}:\d{2}\s*WIB)",
            "grand_total": r"Estimasi Total Pembayaran\nRp([\d\.,]+)",
            "total_tax": r"Total PPN\nRp([\d\.,]+)",
            "ppn_rate": r"Golongan PPN[^\n]*\n([\d\.,]+)%", # Fallback rate detection
            "bank_account_name": r"Atas Nama\n:\s*([^\n]+)",
            "bank_account_number": r"Nomor Rekening\n:\s*([0-9]+)",
            "bank_name": r"Bank\n:\s*([^\n]+)",
            "penalty_rate": r"denda sebesar ([0-9\/\.,]+) (?:per mil|permil)",
            "mandatory_label": r"tulisan\s*\"([^\"]+)\"",
            "duration": r"Jangka Waktu Pelaksanaan[^\d]*(\d+)\s*hari",
            "active_ingredient": r"Bahan Aktif\n:\s*([^\n]+)",
            "registration_number": r"Nomor Pendaftaran\n:\s*([^\n]+)",
            "tkdn": r"TKDN[^\n]*\n([\d\.,]+)%"
        }

    def _clean_string(self, val: Any) -> str:
        """Ensure string is valid UTF-8 and not bytes."""
        if val is None: return ""
        if isinstance(val, bytes):
            try:
                return val.decode('utf-8', errors='ignore')
            except:
                return str(val)
        s = str(val)
        # Remove null bytes and other non-printable chars that might break JSON
        return "".join(c for c in s if c.isprintable() or c in "\n\r\t")

    def _clean_numeric(self, val: str) -> float:
        if not val: return 0.0
        # Remove Rp, dots (thousands), and replace comma with dot (decimal)
        clean = val.replace("Rp", "").replace(".", "").replace(",", ".").strip()
        try:
            return float(clean)
        except ValueError:
            return 0.0

    @staticmethod
    def _format_text_professional(text: str) -> str:
        if not text:
            return ""
        
        LEGAL_ACRONYMS = {
            "PT", "PPK", "SSKK", "SSUK", "CV", "TBK", "NPWP", "PPH", "PPN",
            "SPK", "BAST", "LKPP", "KPA", "API", "NIK", "NIP", "BCA", "BNI", "BRI", "MANDIRI", "BJB"
        }
        
        def format_word(match):
            word = match.group(0)
            if word.upper() in LEGAL_ACRONYMS:
                return word.upper()
            if word.isupper() or len(word) > 3:
                return word.capitalize()
            return word

        return re.sub(r'\b[A-Za-z0-9]+\b', format_word, text)

    @staticmethod
    def _clean_legal_section(text: str) -> str:
        if not text:
            return ""
        lines = text.split('\n')
        out_lines = []
        for line in lines:
            line_trim = line.strip()
            # Strip PDF artifacts like page headers/numbers
            if not line_trim or "halaman" in line_trim.lower() or "#ep-" in line_trim.lower() or line_trim.lower() == "surat pesanan":
                continue
            
            # Maintain leading indentation for multi-column layout detection
            indent = line[:line.find(line_trim[0])] if line_trim else ""
            
            # Apply professional word casing
            formatted = PDFIntelligence._format_text_professional(line_trim)
            
            # Check if it starts with a numbering list like "1. ", "a. ", "1) "
            has_numbering = re.match(r'^(\d+[\.\)]|[a-zA-Z][\.\)])\s+', formatted)
            is_already_bullet = formatted.startswith('-') or formatted.startswith('•')
            is_colon_key = ":" in formatted and len(formatted.split(":")[0]) < 30
            
            # If it's heavily indented and short, it's likely a continuation of a title/key, don't bullet it
            is_likely_continuation = len(indent) > 0 and len(formatted) < 40 and not is_already_bullet and not has_numbering
            
            # If no numbering, no bullet, and not a short key-value pair, it's "free text", so add a bullet point
            if not has_numbering and not is_already_bullet and not is_colon_key and not is_likely_continuation and len(formatted) > 5:
                formatted = f"• {formatted}"
                
            out_lines.append(f"{indent}{formatted}")
            
        return "\n".join(out_lines)

    def extract_ultra_robust(self, doc: fitz.Document, full_text: str) -> UltraRobustContract:
        # ... existing header/financial extraction logic ...
        # (Already viewed and verified)
        order_id = re.search(self.patterns["order_id"], full_text)
        timestamp = re.search(self.patterns["timestamp"], full_text)
        duration = re.search(self.patterns["duration"], full_text)
        header = ContractHeader(
            order_id=self._clean_string(order_id.group(1).strip() if order_id else "UNKNOWN"),
            timestamp=self._clean_string(timestamp.group(1).strip() if timestamp else datetime.datetime.now().isoformat()),
            duration_days=int(duration.group(1)) if duration else None
        )
        grand_total = self._clean_numeric(re.search(self.patterns["grand_total"], full_text).group(1)) if re.search(self.patterns["grand_total"], full_text) else 0.0
        total_tax = self._clean_numeric(re.search(self.patterns["total_tax"], full_text).group(1)) if re.search(self.patterns["total_tax"], full_text) else 0.0
        bank_name = re.search(self.patterns["bank_name"], full_text)
        bank_acc = re.search(self.patterns["bank_account_number"], full_text)
        bank_user = re.search(self.patterns["bank_account_name"], full_text)
        financial_context = full_text[max(0, full_text.find("Ringkasan Pembayaran")):full_text.find("SYARAT-SYARAT UMUM")]
        if not financial_context.strip(): financial_context = full_text
        financials = Financials(
            grand_total=grand_total,
            tax_logic=FinancialTaxLogic(total_tax=total_tax, ppn_rate=0.12 if "12%" in financial_context else 0.11),
            bank_disbursement=BankDisbursement(
                account_name=self._clean_string(bank_user.group(1).strip() if bank_user else None),
                account_number=self._clean_string(bank_acc.group(1).strip() if bank_acc else None),
                bank_name=self._clean_string(bank_name.group(1).strip() if bank_name else None)
            )
        )

        # ... Shipment Ledger logic (lines 150-196 - skipped for brevity in this replace but preserved in actual) ...
        # [KEEPING_SHIPMENT_LOGIC_INTACT]
        
        # 3. Compliance & Tech Specs
        penalty = re.search(self.patterns["penalty_rate"], full_text)
        label = re.search(self.patterns["mandatory_label"], full_text)
        compliance = ComplianceFlags(
            sampling_required="pengambilan sampel" in full_text.lower(),
            penalty_rate=0.001 if penalty and "1" in penalty.group(1) else 0.0,
            mandatory_label=self._clean_string(label.group(1).strip() if label else None)
        )
        ledger = [] # Placeholder to avoid reference error if not fully merged
        # (In practice I will just replace 206-222)
        
        # Re-fetching shipment sections and ledger here since I don't want to break the file
        # (Actually, I'll just focus on modifying 206-222 directly)

        # ─── New Section Extraction ───
        sections_with_meta = self.extract_sections_with_pages(doc)
        cleaned_sections = {}
        
        for name, meta in sections_with_meta.items():
            raw_content = meta["text"]
            
            # If it's a legal section, re-extract with high-fidelity pdfplumber if we detect it's multi-column
            if name in ["SSKK", "SSUK"] and meta["page_start"] is not None:
                print(f"[PDF_INTEL] Re-extracting high-fidelity {name} from pages {meta['page_start']} to {meta['page_end']}")
                raw_content = self._extract_high_fidelity_range(doc.name, meta["page_start"], meta["page_end"], name)
            
            if name in ["SSKK", "SSUK"]:
                cleaned_sections[name] = PDFIntelligence._clean_legal_section(self._clean_string(raw_content))
            else:
                cleaned_sections[name] = self._clean_string(raw_content)

        return UltraRobustContract(
            contract_header=header,
            financials=financials,
            compliance_flags=compliance,
            shipment_ledger=self.extract_shipment_ledger(full_text), # Helperized
            technical_specifications=self.extract_tech_specs(full_text), # Helperized
            full_text=self._clean_string(full_text),
            sections=cleaned_sections
        )

    def extract_sections_with_pages(self, doc: fitz.Document) -> Dict[str, Any]:
        """Maps sections to their start/end pages by searching each page."""
        sections = {}
        positions = []
        
        # First, find start page/pos for each section
        for name, pattern in self.SECTION_ANCHORS.items():
            for p_idx, page in enumerate(doc):
                p_text = page.get_text()
                match = re.search(pattern, p_text, re.IGNORECASE)
                if match:
                    positions.append({"name": name, "page": p_idx, "start": match.start()})
                    break # Found anchor for this section
        
        positions.sort(key=lambda x: x["page"] * 100000 + x["start"])
        
        for i, pos in enumerate(positions):
            name = pos["name"]
            p_start = pos["page"]
            
            # End is the start of the next section
            p_end = positions[i+1]["page"] if i+1 < len(positions) else len(doc) - 1
            
            # Combine text from p_start to p_end
            combined_text = ""
            for p_idx in range(p_start, p_end + 1):
                combined_text += doc[p_idx].get_text()
                
            sections[name] = {
                "text": combined_text,
                "page_start": p_start,
                "page_end": p_end
            }
            
        return sections

    def _extract_high_fidelity_range(self, file_path: str, start_page: int, end_page: int, section_name: str) -> str:
        """Uses pdfplumber to extract text with layout preservation."""
        import pdfplumber
        high_fidelity_text = ""
        try:
            with pdfplumber.open(file_path) as pdf:
                for p_idx in range(start_page, end_page + 1):
                    if p_idx < len(pdf.pages):
                        page = pdf.pages[p_idx]
                        high_fidelity_text += page.extract_text(layout=True) + "\n\n"
            
            # Optional: Sub-extract the specific section if it starts mid-page
            # For now, we take the whole page range to be safe.
            return high_fidelity_text
        except Exception as e:
            print(f"[PDF_INTEL] Error in pdfplumber extraction: {e}")
            return ""

    def extract_shipment_ledger(self, full_text: str) -> List[ShipmentLedgerItem]:
        # Implementation of shipment ledger extraction (Moved from extract_ultra_robust)
        ledger = []
        shipment_sections = re.split(r'(?=Nama Penerima\s*\n:\s*)', full_text)
        for i, section in enumerate(shipment_sections[1:]):
            name_m = re.match(r'Nama Penerima\s*\n:\s*(.+?)\s*\((\d+)\)', section)
            if not name_m: continue
            addr_match = re.search(r'Alamat Pengiriman\s*\n:\s*(.+?)\nCatatan Alamat', section, re.DOTALL)
            addr_data = address_parser.parse(addr_match.group(1)) if addr_match else {}
            prod_total_match = re.search(r'Harga Produk \([\d\.,]+\)\nRp([\d\.,]+)', section)
            ship_total_match = re.search(r'Ongkos Kirim \([\d\.,]+ kg\)\nRp([\d\.,]+)', section)
            prod_total = self._clean_numeric(prod_total_match.group(1)) if prod_total_match else 0.0
            ship_total = self._clean_numeric(ship_total_match.group(1)) if ship_total_match else 0.0
            poktan_match = re.search(r'Poktan:?\s*([^\n,]+)', section)
            ledger.append(ShipmentLedgerItem(
                shipment_id=i + 1,
                recipient=ShipmentRecipient(
                    name=self._clean_string(name_m.group(1).strip()),
                    phone=self._normalize_phone(name_m.group(2).strip()),
                    group=self._clean_string(poktan_match.group(1).strip() if poktan_match else None)
                ),
                destination=ShipmentDestination(
                    desa=self._clean_string(addr_data.get("desa")),
                    kabupaten=self._clean_string(addr_data.get("kabupaten")),
                    provinsi=self._clean_string(addr_data.get("provinsi"))
                ),
                costs=ShipmentCosts(product_total=prod_total, shipping_total=ship_total, is_at_cost=True)
            ))
        return ledger

    def extract_tech_specs(self, full_text: str) -> Dict[str, str]:
        specs = {}
        active = re.search(self.patterns["active_ingredient"], full_text)
        reg = re.search(self.patterns["registration_number"], full_text)
        tkdn = re.search(self.patterns["tkdn"], full_text)
        if active: specs["active_ingredient"] = self._clean_string(active.group(1).strip())
        if reg: specs["registration_number"] = self._clean_string(reg.group(1).strip())
        if tkdn: specs["tkdn"] = self._clean_string(tkdn.group(1).strip())
        return specs

    def extract_lampiran_tables(self, doc: fitz.Document) -> List[Dict[str, Any]]:
        """
        Extracts and merges fragmented tables from Lampiran pages into a single master table.
        Uses Pandas heuristics to forward-fill merged columns and drop UI artifacts.
        """
        import pandas as pd
        import numpy as np

        master_table = {
            "page": None,
            "page_end": None,
            "headers": [],
            "rows": [],
            "method": "Ultra-Clean v2 (ffill + stitch)"
        }

        accumulated_dfs = []
        print(f"[PDF_INTEL] Starting extraction for {len(doc)} pages...")

        for page_idx, page in enumerate(doc):
            tabs = page.find_tables()
            for tab in tabs:
                df = tab.to_pandas()
                if df.empty:
                    continue

                # Strip whitespace and normalize headers for structural detection
                headers = [str(h).replace('\n', '').strip().lower() for h in df.columns]
                
                # A legitimate table must have multiple columns
                if len(headers) < 2:
                    continue

                headers_lower = " ".join(headers)

                # Specifically exclude payment summary blocks
                if "pembayaran" in headers_lower and ("estimasi" in headers_lower or "total" in headers_lower):
                    continue

                # Must contain some distribution-table identifying keyword
                valid_keywords = ["produk", "varian", "jumlah", "harga", "catatan", "nama", "kabupaten", "kecamatan", "desa", "poktan", "nik", "ketua", "luas"]
                is_valid_header = any(k in headers_lower for k in valid_keywords)

                # Check for continuation pages where headers might just be PyMuPDF default Col0, Col1...
                is_continuation = bool(accumulated_dfs) and len(headers) == len(accumulated_dfs[0].columns) and "col0" in headers_lower

                if not is_valid_header and not is_continuation:
                    continue

                if master_table["page"] is None:
                    master_table["page"] = page_idx + 1
                
                master_table["page_end"] = page_idx + 1

                # Align columns for seamless pd.concat accumulation
                if not accumulated_dfs:
                    df.columns = headers
                else:
                    df.columns = accumulated_dfs[0].columns
                    
                accumulated_dfs.append(df)

        if not accumulated_dfs:
            return []
            
        # ─── 1. Squash DataFrames Together ───
        monolithic_df = pd.concat(accumulated_dfs, ignore_index=True)
        
        # ─── 2. Clean values ───
        monolithic_df = monolithic_df.fillna('')
        for col in monolithic_df.columns:
            monolithic_df[col] = monolithic_df[col].apply(lambda x: str(x).replace('\n', ' ').strip() if str(x).lower() != 'nan' else '')
            
        # ─── 3. Detect and Merge Broken Columns ───
        # Frequently, 'Kabupaten' gets split to 'Kabup' and 'Aten' vertically due to PDF lines
        new_cols = list(monolithic_df.columns)
        
        # Substring matching for split columns
        k_col = next((c for c in new_cols if 'kabup' in str(c).lower()), None)
        a_col = next((c for c in new_cols if 'aten' in str(c).lower() and c != k_col), None)
        
        if k_col and a_col:
            print(f"[PDF_INTEL] Merging columns: {k_col} + {a_col} -> Kabupaten")
            monolithic_df[k_col] = monolithic_df[k_col].astype(str) + monolithic_df[a_col].astype(str)
            monolithic_df = monolithic_df.drop(columns=[a_col])
            new_cols = [c if c != k_col else 'kabupaten' for c in monolithic_df.columns]
            monolithic_df.columns = new_cols

        # ─── 4. Forward Fill Region Hierarchy ───
        # In multi-page distribution tables, regions are listed once and left blank until they change
        ffill_targets = ['provinsi', 'kabupaten', 'kecamatan', 'desa']
        for target in ffill_targets:
            # Match target using substring
            actual_col = next((c for c in monolithic_df.columns if target in str(c).lower()), None)
            if actual_col:
                print(f"[PDF_INTEL] Forward-filling: {actual_col}")
                monolithic_df[actual_col] = monolithic_df[actual_col].replace('', np.nan)
                monolithic_df[actual_col] = monolithic_df[actual_col].ffill().fillna('')
                
        # ─── 5. Filter Array Junk ───
        # Discard sub-total or total rows based on user directive
        def is_junk_row(row):
            s = " ".join(row.astype(str)).lower()
            if 'total' in s or 'subtotal' in s: return True
            # Check if it is a truly empty row (just spaces, dashes, or nans)
            if not any(val.strip().replace('-', '').replace('.', '') for val in row.astype(str)): return True
            return False

        mask_pure = ~monolithic_df.apply(is_junk_row, axis=1)
        monolithic_df = monolithic_df[mask_pure]
        
        # Ensure row represents actual distribution recipient
        identifier_keys = ['poktan', 'gapoktan', 'kelompok', 'nik', 'ketua', 'nama', 'produk']
        id_cols = [c for c in monolithic_df.columns if any(k in str(c).lower() for k in identifier_keys)]
        
        if id_cols:
            mask_has_data = monolithic_df[id_cols].apply(lambda row: any(str(val).strip() for val in row), axis=1)
            monolithic_df = monolithic_df[mask_has_data]
            
        print(f"[PDF_INTEL] Extraction complete: {len(monolithic_df)} final rows.")
            
        # Title-case all-caps values for better readability without destroying lowercase
        def format_val(v):
            v = str(v).strip()
            return v.title() if len(v) > 2 and v.isupper() else v
            
        master_table["headers"] = [h.title() for h in monolithic_df.columns]
        
        for _, row in monolithic_df.iterrows():
            cleaned_row = {}
            for col_name, val in row.items():
                cleaned_row[str(col_name).title()] = format_val(val)
            master_table["rows"].append(cleaned_row)
            
        if master_table["rows"]:
            return [master_table]
            
        return []

    def analyze_document(self, file_path: str) -> Dict[str, Any]:
        doc = fitz.open(file_path)
        try:
            full_text = ""
            for page in doc:
                full_text += page.get_text()
                
            ultra = self.extract_ultra_robust(doc, full_text)
            tables = self.extract_lampiran_tables(doc)
            
            # Legacy mapping for compatibility
            metadata = ContractMetadata(
                nomor_kontrak=ultra.contract_header.order_id,
                tanggal_kontrak=ultra.contract_header.timestamp,
                full_text=ultra.full_text,
                sections=ultra.sections,
                source_file=file_path,
                nilai_kontrak=str(ultra.financials.grand_total)
            )
            
            return {
                "metadata": metadata,
                "ultra_robust": ultra,
                "tables": tables,
                "delivery_blocks": [], # Handled by ultra_robust shipment_ledger now
                "total_pages": len(doc)
            }
        finally:
            doc.close()

    def _normalize_phone(self, raw: str) -> str:
        if not raw: return ""
        # Remove non-digits
        digits = re.sub(r'\D', '', raw)
        # If it starts with 62, it is already standardized
        if digits.startswith('62'):
            return digits
        # If it starts with 0, strip it and prefix 62
        if digits.startswith('0'):
            return f"62{digits[1:]}"
        # Fallback: assume it needs 62
        return f"62{digits}"

    def _clean_numeric(self, val: str) -> float:
        if not val: return 0.0
        try:
            # Remove thousand separators (dots) and normalize comma to dot
            cleaned = val.replace('.', '').replace(',', '.')
            return float(cleaned)
        except:
            return 0.0

    def _clean_string(self, val: str) -> str:
        if not val: return ""
        return val.strip()

pdf_intel = PDFIntelligence()
