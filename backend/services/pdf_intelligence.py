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

    def extract_ultra_robust(self, doc: fitz.Document, full_text: str) -> UltraRobustContract:
        # 1. Header Extraction
        order_id = re.search(self.patterns["order_id"], full_text)
        timestamp = re.search(self.patterns["timestamp"], full_text)
        duration = re.search(self.patterns["duration"], full_text)
        
        header = ContractHeader(
            order_id=self._clean_string(order_id.group(1).strip() if order_id else "UNKNOWN"),
            timestamp=self._clean_string(timestamp.group(1).strip() if timestamp else datetime.datetime.now().isoformat()),
            duration_days=int(duration.group(1)) if duration else None
        )

        # 2. Financials
        grand_total = self._clean_numeric(re.search(self.patterns["grand_total"], full_text).group(1)) if re.search(self.patterns["grand_total"], full_text) else 0.0
        total_tax = self._clean_numeric(re.search(self.patterns["total_tax"], full_text).group(1)) if re.search(self.patterns["total_tax"], full_text) else 0.0
        
        bank_name = re.search(self.patterns["bank_name"], full_text)
        bank_acc = re.search(self.patterns["bank_account_number"], full_text)
        bank_user = re.search(self.patterns["bank_account_name"], full_text)

        financials = Financials(
            grand_total=grand_total,
            tax_logic=FinancialTaxLogic(
                total_tax=total_tax,
                ppn_rate=0.12 if "12%" in full_text else 0.11 # Intelligent fallback
            ),
            bank_disbursement=BankDisbursement(
                account_name=self._clean_string(bank_user.group(1).strip() if bank_user else None),
                account_number=self._clean_string(bank_acc.group(1).strip() if bank_acc else None),
                bank_name=self._clean_string(bank_name.group(1).strip() if bank_name else None)
            )
        )

        # 3. Compliance
        penalty = re.search(self.patterns["penalty_rate"], full_text)
        label = re.search(self.patterns["mandatory_label"], full_text)
        
        compliance = ComplianceFlags(
            sampling_required="pengambilan sampel" in full_text.lower(),
            penalty_rate=0.001 if penalty and "1" in penalty.group(1) else 0.0,
            mandatory_label=self._clean_string(label.group(1).strip() if label else None)
        )

        # 4. Shipment Ledger (RPB Blocks)
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
                    phone=f"62{name_m.group(2).strip()[-10:]}", # Standardize to 62
                    group=self._clean_string(poktan_match.group(1).strip() if poktan_match else None)
                ),
                destination=ShipmentDestination(
                    desa=self._clean_string(addr_data.get("desa")),
                    kabupaten=self._clean_string(addr_data.get("kabupaten")),
                    provinsi=self._clean_string(addr_data.get("provinsi"))
                ),
                costs=ShipmentCosts(
                    product_total=prod_total,
                    shipping_total=ship_total,
                    is_at_cost=True
                )
            ))

        # 5. Tech Specs
        specs = {}
        active = re.search(self.patterns["active_ingredient"], full_text)
        reg = re.search(self.patterns["registration_number"], full_text)
        tkdn = re.search(self.patterns["tkdn"], full_text)
        if active: specs["active_ingredient"] = self._clean_string(active.group(1).strip())
        if reg: specs["registration_number"] = self._clean_string(reg.group(1).strip())
        if tkdn: specs["tkdn"] = self._clean_string(tkdn.group(1).strip())

        return UltraRobustContract(
            contract_header=header,
            financials=financials,
            compliance_flags=compliance,
            shipment_ledger=ledger,
            technical_specifications=specs,
            full_text=self._clean_string(full_text),
            sections={k: self._clean_string(v) for k, v in self.extract_sections(full_text).items()}
        )

    def extract_sections(self, full_text: str) -> Dict[str, str]:
        positions = []
        for name, pattern in self.SECTION_ANCHORS.items():
            match = re.search(pattern, full_text, re.IGNORECASE)
            if match:
                positions.append((name, match.start()))
        
        positions.sort(key=lambda x: x[1])
        sections = {}
        for i, (name, start) in enumerate(positions):
            end = positions[i+1][1] if i+1 < len(positions) else len(full_text)
            sections[name] = full_text[start:end].strip()
        return sections

    def extract_lampiran_tables(self, doc: fitz.Document) -> List[Dict[str, Any]]:
        """Ported logic to extract structured tables from Lampiran pages."""
        tables = []
        for page_idx, page in enumerate(doc):
            tabs = page.find_tables()
            for tab in tabs:
                df = tab.to_pandas()
                if not df.empty:
                    # Basic cleaning of headers and rows
                    headers = [self._clean_string(str(h)) for h in df.columns]
                    rows = []
                    for _, row in df.iterrows():
                        rows.append({headers[i]: self._clean_string(str(v)) for i, v in enumerate(row)})
                    
                    tables.append({
                        "page": page_idx + 1,
                        "headers": headers,
                        "rows": rows,
                        "method": "find_tables"
                    })
        return tables

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

pdf_intel = PDFIntelligence()
