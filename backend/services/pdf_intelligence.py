import fitz  # PyMuPDF
import re
import datetime
import json
import zipfile
import tempfile
import os
from typing import List, Dict, Any, Optional
from backend.services.address_parser import address_parser
from backend.models import (
    UltraRobustContract, ContractHeader, Financials, FinancialTaxLogic,
    BankDisbursement, ComplianceFlags, ShipmentLedgerItem, ShipmentRecipient,
    ShipmentDestination, ShipmentCosts, ContractMetadata,
    PipelineRow, BundleRequest
)
from backend.services.diagnostics import diagnostics

class PDFIntelligence:
    SECTION_ANCHORS = {
        "HEADER": r"(?i)Surat\s*Pesanan",
        "PEMESAN": r"(?im)^\s*Pemesan\s*$",
        "PENYEDIA": r"(?im)^\s*Penyedia\s*$",
        "RINGKASAN_PESANAN": r"(?im)^\s*Ringkasan\s*Pesanan\s*$",
        "RINGKASAN_PEMBAYARAN": r"(?im)^\s*Ringkasan\s*Pembayaran\s*$",
        "SSUK": r"(?i)SYARAT-SYARAT\s*UMUM\s*KONTRAK",
        "SSKK": r"(?i)SYARAT-SYARAT\s*KHUSUS\s*KONTRAK",
        "LAMPIRAN": r"(?im)^\s*Lampiran\s+\d+\."
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
    def _remove_page_artifacts(text: str) -> str:
        """Surgically strips multipage interstitial artifacts (Halaman X/Y, Surat Pesanan headers) 
        without breaking the paragraph flow layout."""
        if not text:
            return ""
        
        # 1. Strip interstitial multipage headers
        artifact_pattern = r'(?im)^\s*(?:Halaman\s+\d+/\d+)?\s*\n*(?:^\s*Lampiran\s*\n+)?^\s*No\.\s*Surat\s*Pesanan\s*:[^\n]*\n+^\s*Tanggal\s*Surat\s*Pesanan\s*:[^\n]*\n*(?:^\s*\n)*'
        cleaned = re.sub(artifact_pattern, '', text)
        
        # 2. Strict terminal chop: if the layout text accidentally captured the next major section (Lampiran 1)
        # we completely chop the string at that exact marker.
        trailing_match = re.search(r'(?im)^\s*Lampiran\s+\d+\.', cleaned)
        if trailing_match:
            cleaned = cleaned[:trailing_match.start()]
            
        # 3. Strip dangling "Halaman X" at the very end of the document block if caught without next page header
        cleaned = re.sub(r'(?i)\s*Halaman\s+\d+/\d+\s*\n*$', '', cleaned)
        return cleaned.strip()

    @staticmethod
    def _parse_sskk_structure(cleaned_text: str) -> List[Dict[str, Any]]:
        """
        Parses the cleaned SSKK string layout into structured JSON clauses based on physical column offsets.
        Implements a Sliding Margin algorithm to prevent word-tearing when kerning eliminates column gaps.
        """
        clauses = []
        if not cleaned_text:
            return clauses
            
        pattern = r'(?m)^\s{10,24}(\d+)\.\s+'
        matches = list(re.finditer(pattern, cleaned_text))
        
        for i, match in enumerate(matches):
            nomor = match.group(1)
            start_idx = match.end()
            end_idx = matches[i+1].start() if i + 1 < len(matches) else len(cleaned_text)
            
            block = cleaned_text[start_idx:end_idx]
            lines = block.strip('\n').split('\n')
            
            title_words = []
            body_words = []
            
            for line in lines:
                if not line.strip(): continue
                leading_spaces = len(line) - len(line.lstrip())
                
                # If the text inherently starts beyond the Title column threshold, it's definitively Body text.
                if leading_spaces > 28:
                    body_words.append(line.strip())
                    continue
                    
                parts = re.split(r'\s{2,}', line.strip(), maxsplit=1)
                
                # Sub-clause Intelligence: Detect if a sub-number (e.g. 12.1 or 12.a) is tucked into the title
                # We look for the pattern: current article number + dot + digit/letter
                sub_marker = rf"\b{nomor}\.[a-z0-9]\b"
                sub_match = re.search(sub_marker, line.strip(), re.IGNORECASE)
                
                if sub_match:
                    # Force split at the sub-clause marker
                    split_pos = sub_match.start()
                    t_part = line.strip()[:split_pos].strip()
                    b_part = line.strip()[split_pos:].strip()
                    if t_part: title_words.append(t_part)
                    if b_part: body_words.append(b_part)
                    continue

                if len(parts) == 2:
                    title_words.append(parts[0].strip())
                    body_words.append(parts[1].strip())
                else:
                    # Single-space column merging protection: calculate nearest safe split margin
                    best_split_idx = 31
                    if len(line) > best_split_idx:
                        if line[best_split_idx] != ' ':
                            left_space = line.rfind(' ', 0, best_split_idx)
                            right_space = line.find(' ', best_split_idx)
                            
                            if left_space != -1 and right_space != -1:
                                best_split_idx = left_space if (best_split_idx - left_space < right_space - best_split_idx) else right_space
                            elif left_space != -1:
                                best_split_idx = left_space
                            elif right_space != -1:
                                best_split_idx = right_space
                                
                        t_part = line[:best_split_idx].strip()
                        b_part = line[best_split_idx:].strip()
                        if t_part: title_words.append(t_part)
                        if b_part: body_words.append(b_part)
                    else:
                        title_words.append(line.strip())
            
            clauses.append({
                'nomor': nomor,
                'judul': ' '.join(title_words).strip(),
                'isi': PDFIntelligence._beautify_legal_body('\n'.join(body_words).strip())
            })
            
        return clauses

    @staticmethod
    def _beautify_legal_body(text: str) -> str:
        """
        Beautifies legal body text by normalizing list markers, transforming 
        alphanumeric sub-clauses, and bolding markers for prominence.
        """
        if not text:
            return ""
            
        # 1. Normalize spacing for "x )" markers
        text = re.sub(r'(\b[a-zA-Z0-9])\s+\)', r'\1)', text)
        
        # 2. Transform Alphanumeric sub-clauses: "x.a" -> "xa."
        # Pattern: digits + dot + letter
        text = re.sub(r'\b(\d+)\.([a-z]\b)', r'\1\2.', text)
        
        # 3. Inject double newlines before list items to create "Stanza" layout
        # Case A: Numeric/Alpha markers like 1) or a)
        pattern_brace = r'(?<!^)\s*\b([a-zA-Z0-9]\))(?=\s)'
        text = re.sub(pattern_brace, r'\n\n\1', text)
        
        # Case B: Sub-clause markers like 3.1 or 12a.
        # We handle both the dots and the new 'xa.' format
        pattern_sub = r'(?<!^)\s*\b(\d+\.[0-9]|\d+[a-z]\.)(?=\s)'
        text = re.sub(pattern_sub, r'\n\n\1', text)
        
        # 4. Bolding pass: Wrap all detected markers in **bold**
        # We do this after spacing to avoid messing up the newlines
        bold_pattern = r'\b([a-zA-Z0-9]\)|\d+\.[0-9]|\d+[a-z]\.)(?=\s)'
        text = re.sub(bold_pattern, r'**\1**', text)
        
        # 5. Structural Cleanup
        # Remove triple newlines introduced by merging existing breaks
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        return text.strip()

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
            is_structural_header = formatted.startswith('---')
            
            # If it's heavily indented and short, it's likely a continuation of a title/key, don't bullet it
            is_likely_continuation = len(indent) > 0 and len(formatted) < 40 and not is_already_bullet and not has_numbering and not is_structural_header
            
            # If no numbering, no bullet, and not a short key-value pair, it's "free text", so add a bullet point
            # EXPERT REFINEMENT: If it's a colon key (KV pair), NEVER add a bullet to the key part.
            if not has_numbering and not is_already_bullet and not is_colon_key and not is_likely_continuation and not is_structural_header and len(formatted) > 5:
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
        sections_with_meta = self.extract_sections_with_pages(doc, full_text)
        cleaned_sections = {}
        sskk_clauses = []
        
        for name, meta in sections_with_meta.items():
            raw_content = meta["text"]
            
            if name in ["SSKK", "SSUK"] and meta["page_start"] is not None:
                print(f"[PDF_INTEL] Re-extracting high-fidelity {name} from pages {meta['page_start']} to {meta['page_end']}")
                
                # Determine the end pattern if available to cleanly slice the layout text
                idx = list(sections_with_meta.keys()).index(name)
                keys = list(sections_with_meta.keys())
                end_pattern = None
                if idx + 1 < len(keys):
                    next_name = keys[idx + 1]
                    end_pattern = self.SECTION_ANCHORS.get(next_name)
                    
                raw_content = self._extract_high_fidelity_range(
                    doc.name, meta["page_start"], meta["page_end"], name,
                    start_pattern=self.SECTION_ANCHORS.get(name),
                    end_pattern=end_pattern
                )
            
            if name in ["SSKK", "SSUK"]:
                content = self._clean_string(raw_content)
                if name == "SSKK":
                    # Use accurate layout-preserving scrubber instead of destructive cleaner
                    content = PDFIntelligence._remove_page_artifacts(content)
                    cleaned_sections[name] = content
                    # Perform structural scanning to output machine-ready data
                    sskk_clauses = PDFIntelligence._parse_sskk_structure(content)
                else:
                    cleaned_sections[name] = PDFIntelligence._clean_legal_section(content)
            elif name == "LAMPIRAN":
                # User requested to skip raw parsing for Lampiran; we only want the data table
                continue
            else:
                cleaned_sections[name] = self._clean_string(raw_content)

        return UltraRobustContract(
            contract_header=header,
            financials=financials,
            compliance_flags=compliance,
            shipment_ledger=self.extract_shipment_ledger(full_text), # Helperized
            technical_specifications=self.extract_tech_specs(full_text), # Helperized
            full_text=self._clean_string(full_text),
            sections=cleaned_sections,
            parsed_sskk_clauses=sskk_clauses
        )

    def _refine_sskk_content(self, text: str) -> str:
        """Injects structural markers into SSKK sections to separate shared entities (PPK vs Penyedia)."""
        # 1. Handle "Korespondensi" Split
        if "Korespondensi" in text:
            # We insert headers that the KeyValueRenderer will interpret as group dividers (needs " : —")
            text = text.replace("Alamat Para Pihak sebagai berikut:", "PEMESAN / SATUAN KERJA : —")
            
            # Detect the "Penyedia :" line as the pivot
            pivot_pattern = r'(\bPenyedia\s*:\s*)'
            if re.search(pivot_pattern, text):
                text = re.sub(pivot_pattern, r'PENYEDIA : —\n\1', text, count=1)
        
        # 2. Handle "Wakil sah para pihak" Split
        if "Wakil sah" in text:
            # Handle variations of the "Wakil Sah" sentence
            text = re.sub(r'Wakil Sah.*?Penyedia.*?berikut:?', 'WAKIL SAH PPK DAN PENYEDIA : —', text, flags=re.IGNORECASE)
            text = text.replace("Untuk PPK", "UNTUK PPK")
            text = text.replace("Untuk Penyedia", "UNTUK PENYEDIA")
            
        return text

    def extract_sections_with_pages(self, doc: fitz.Document, full_text: str) -> Dict[str, Any]:
        """Maps sections to their start/end indices in the full_text."""
        sections = {}
        positions = []
        
        # 1. Find the first occurrence of each anchor in the full document text
        # Using full_text ensures indices are consistent across the whole doc.
        for name, pattern in self.SECTION_ANCHORS.items():
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                positions.append({
                    "name": name, 
                    "start": match.start(),
                    "match_text": match.group(0)
                })
        
        # 2. Sort positions by their occurrence in the document
        positions.sort(key=lambda x: x["start"])
        
        # 3. Slice the text between anchors
        for i, pos in enumerate(positions):
            name = pos["name"]
            idx_start = pos["start"]
            
            # The section ends where the next section starts, or at the end of the text
            idx_end = positions[i+1]["start"] if i+1 < len(positions) else len(full_text)
            
            section_text = full_text[idx_start:idx_end]
            
            # Identify which pages this section spans for high-fidelity fallback
            # We estimate pages by looking at cumulative page text lengths
            p_start, p_end = self._estimate_page_range(doc, idx_start, idx_end)
            
            sections[name] = {
                "text": section_text,
                "page_start": p_start,
                "page_end": p_end
            }
            
        return sections

    def _estimate_page_range(self, doc: fitz.Document, start_idx: int, end_idx: int):
        """Estimate the physical page range for a text span based on cumulative get_text length.
        Fixed to correctly handle exact boundaries."""
        page_offsets = []
        cumulative = 0
        for i, page in enumerate(doc):
            p_len = len(page.get_text())
            page_offsets.append({
                "page": i,
                "start": cumulative,
                "end": cumulative + p_len
            })
            cumulative += p_len

        def get_page(char_idx):
            for po in page_offsets:
                # Use strict less-than for end to prevent off-by-one on exact boundaries
                if po["start"] <= char_idx < po["end"]:
                    return po["page"]
            return page_offsets[-1]["page"] if page_offsets else 0

        p_start = get_page(start_idx)
        p_end = get_page(max(0, end_idx - 1)) # -1 because end_idx is exclusive

        return (p_start, p_end)

    def _extract_high_fidelity_range(self, file_path: str, start_page: int, end_page: int, section_name: str, start_pattern: str = None, end_pattern: str = None) -> str:
        """Uses pdfplumber to extract text with layout preservation, sliced exactly to the required anchors."""
        import pdfplumber
        high_fidelity_text = ""
        try:
            with pdfplumber.open(file_path) as pdf:
                for p_idx in range(start_page, end_page + 1):
                    if p_idx < len(pdf.pages):
                        page = pdf.pages[p_idx]
                        high_fidelity_text += page.extract_text(layout=True) + "\n\n"
            
            # Slice strictly between start and end anchors to prevent bleeding
            if start_pattern:
                s_match = re.search(start_pattern, high_fidelity_text, re.IGNORECASE)
                if s_match:
                    high_fidelity_text = high_fidelity_text[s_match.start():]
                    
            if end_pattern:
                e_match = re.search(end_pattern, high_fidelity_text, re.IGNORECASE)
                if e_match:
                    high_fidelity_text = high_fidelity_text[:e_match.start()]
                    
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
                    provinsi=self._clean_string(addr_data.get("provinsi")),
                    full_address=self._clean_string(addr_data.get("full_address"))
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
                parsed_sskk_clauses=ultra.parsed_sskk_clauses,
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

    # --- Generation & Utility Methods (Merged from legacy pdf_service) ---

    def generate_bastb_pdf(self, metadata: Dict, recipient: PipelineRow) -> bytes:
        """Expert Template: Berita Acara Serah Terima Barang (BASTB)."""
        with fitz.open() as doc:
            page = doc.new_page(width=595, height=842)
            page.insert_text((150, 60), "BERITA ACARA SERAH TERIMA BARANG (BASTB)", fontsize=12, fontname="helv-bold")
            
            poktan = recipient.group or "Umum"
            page.insert_text((50, 90), f"POKTAN / KELOMPOK: {poktan.upper()}", fontsize=9, fontname="helv-bold")
            
            y = 120
            page.insert_text((50, y), f"No : {metadata.get('nomor_kontrak', '.../BAST/...')}", fontsize=10)
            y += 20
            page.insert_text((50, y), f"Pada hari ini ................. tanggal ........ bulan ............ tahun dua ribu dua puluh lima", fontsize=10)
            
            y += 30
            page.insert_text((50, y), "PIHAK PERTAMA (Pemesan)", fontname="helv-bold", fontsize=10)
            page.insert_text((200, y), f": {metadata.get('satker', 'DITJEN PSP - KEMENTAN')}", fontsize=10)
            
            y += 40
            page.insert_text((50, y), "PIHAK KEDUA (Penerima)", fontname="helv-bold", fontsize=10)
            
            p_name = recipient.name
            if hasattr(recipient, 'proxy') and recipient.proxy:
                p_name = f"{recipient.name} (Diterima Oleh: {recipient.proxy.name} - {recipient.proxy.relation})"
                
            page.insert_text((200, y), f": {p_name}", fontsize=10)
            page.insert_text((200, y+15), f"NIK : {recipient.nik}", fontsize=10)
            
            y += 60
            page.draw_rect([50, y, 545, y+20], color=(0,0,0), width=1)
            page.insert_text((55, y+15), "No", fontsize=9)
            page.insert_text((100, y+15), "Nama Barang", fontsize=9)
            page.insert_text((400, y+15), "Kuantitas", fontsize=9)
            
            y += 20
            page.draw_rect([50, y, 545, y+25], color=(0,0,0), width=0.5)
            page.insert_text((55, y+15), "1", fontsize=9)
            page.insert_text((100, y+15), metadata.get('nama_produk', 'Bantuan Pemerintah'), fontsize=9)
            qty = recipient.financials.qty if hasattr(recipient, 'financials') else 0
            page.insert_text((400, y+15), f"{qty} Unit", fontsize=9)
            
            y = 650
            page.insert_text((50, y), "PIHAK KEDUA", fontsize=10, fontname="helv-bold")
            page.insert_text((400, y), "PIHAK PERTAMA", fontsize=10, fontname="helv-bold")
            
            return doc.tobytes()

    def generate_recipient_report(self, request: BundleRequest, recipient: PipelineRow, master_doc: Optional[fitz.Document] = None) -> bytes:
        """High-Fidelity Report: BASTB + Evidence Slicing + KTP Proof."""
        with fitz.open() as report:
            bastb_bytes = self.generate_bastb_pdf({
                "nomor_kontrak": request.contract_no,
                "tanggal_kontrak": request.contract_date,
                "nama_produk": request.contract_name,
                "satker": "DITJEN PSP"
            }, recipient)
            
            with fitz.open("pdf", bastb_bytes) as bastb_doc:
                report.insert_pdf(bastb_doc)

            page = report.new_page(width=595, height=842)
            page.insert_text((50, 50), "DOKUMENTASI PENYALURAN", fontsize=14, fontname="helv-bold")
            
            y = 100
            page.draw_rect([50, y, 280, y+180], color=(0,0,0), width=1)
            page.insert_text((60, y-10), "KTP / IDENTITAS", fontsize=9, fontname="helv-bold")
            page.draw_rect([310, y, 540, y+180], color=(0,0,0), width=1)
            page.insert_text((320, y-10), "FOTO PENYERAHAN BARANG", fontsize=9, fontname="helv-bold")

            def find_img(directory, bindings, nik):
                if not directory: return None
                for img_name, bound_nik in bindings.items():
                    if bound_nik == nik and "_edited_" in img_name:
                        return os.path.join(directory, img_name)
                for img_name, bound_nik in bindings.items():
                    if bound_nik == nik:
                        return os.path.join(directory, img_name)
                return None

            ktp_p = find_img(request.ktp_dir, request.ktp_bindings, recipient.nik)
            proof_p = find_img(request.proof_dir, request.proof_bindings, recipient.nik)

            if ktp_p and os.path.exists(ktp_p):
                page.insert_image([60, y+10, 270, y+170], filename=ktp_p, keep_proportion=True)
            if proof_p and os.path.exists(proof_p):
                page.insert_image([320, y+10, 530, y+170], filename=proof_p, keep_proportion=True)

            if master_doc and recipient.page_source > 0:
                report.insert_pdf(master_doc, from_page=recipient.page_source-1, to_page=recipient.page_source-1)
                ev_page = report[-1]
                ev_page.draw_rect([0, 0, ev_page.rect.width, 25], fill=(0, 0, 0), color=(0, 0, 0))
                ev_page.insert_text((20, 17), f"LAMPIRAN KONTRAK: HALAMAN {recipient.page_source}", color=(1, 1, 1), fontsize=9)

            return report.tobytes()

    def split_pdf_pages(self, input_path: str, pages: List[int], output_dir: str, prefix: str) -> List[str]:
        if not os.path.exists(output_dir): os.makedirs(output_dir)
        created = []
        with fitz.open(input_path) as doc:
            for p_num in pages:
                with fitz.open() as new_doc:
                    new_doc.insert_pdf(doc, from_page=p_num-1, to_page=p_num-1)
                    out_p = os.path.join(output_dir, f"{prefix}_page_{p_num}.pdf")
                    new_doc.save(out_p)
                    created.append(out_p)
        return created

    def create_contract_bundle_zip(self, request: BundleRequest) -> str:
        """Bundles all recipients into a single ZIP file."""
        diagnostics.log_breadcrumb("BUNDLER", f"Streaming ZIP generation for {len(request.recipients)} recipients")
        
        fd, temp_path = tempfile.mkstemp(suffix=".zip")
        os.close(fd)
        
        try:
            with fitz.open(request.master_pdf_path) if request.master_pdf_path and os.path.exists(request.master_pdf_path) else None as master_doc:
                with zipfile.ZipFile(temp_path, "w", zipfile.ZIP_DEFLATED) as zf:
                    for recipient in request.recipients:
                        pdf_b = self.generate_recipient_report(request, recipient, master_doc)
                        safe_n = "".join([c if c.isalnum() else "_" for c in recipient.name])
                        zf.writestr(f"{recipient.nik}_{safe_n}.pdf", pdf_b)
            return temp_path
        except Exception as e:
            if os.path.exists(temp_path): os.remove(temp_path)
            diagnostics.log_error("ZIP-BUNDLE-ERR", str(e))
            raise e

pdf_intel = PDFIntelligence()
