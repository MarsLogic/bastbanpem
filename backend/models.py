from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class KtpResult(BaseModel):
    nik: Optional[str] = None
    nama: Optional[str] = None
    alamat: Optional[str] = None
    confidence: float = 0.0
    error: Optional[str] = None

class LocationData(BaseModel):
    provinsi: str = ""
    kabupaten: str = ""
    kecamatan: str = ""
    desa: str = ""
    # Suggested repairs from Master Registry
    suggested_provinsi: Optional[str] = None
    suggested_kabupaten: Optional[str] = None
    suggested_kecamatan: Optional[str] = None
    suggested_desa: Optional[str] = None

class FinancialData(BaseModel):
    qty: float = 0.0
    unit_price: float = 0.0
    shipping: float = 0.0
    target_value: float = 0.0
    calculated_value: float = 0.0
    gap: float = 0.0

class PipelineRow(BaseModel):
    id: str
    nik: str
    name: str = ""
    location: LocationData = Field(default_factory=LocationData)
    financials: FinancialData = Field(default_factory=FinancialData)
    jadwal_tanam: str = ""
    group: str = ""
    is_synced: bool = False
    is_excluded: bool = False
    page_source: int = 0
    column_data: Dict[str, Any] = {} # All original columns
    original_row: Dict[str, Any] = {} # Copy for reset
    
class ReconciliationResult(BaseModel):
    rows: List[PipelineRow]
    total_count: int
    unmatched_niks: List[str]
    is_fully_balanced: bool = False
    discovered_headers: List[str] = []

class ExcelIngestResult(BaseModel):
    rows: List[PipelineRow]
    headers: List[str]
    sheet_name: str
    total_target: float

class AutomationRequest(BaseModel):
    nik: str
    payload: Dict
    headless: bool = True

class BundleRequest(BaseModel):
    contract_id: str
    contract_no: str
    contract_date: str
    contract_name: str
    master_pdf_path: str
    ktp_dir: Optional[str] = None
    proof_dir: Optional[str] = None
    ktp_bindings: Dict[str, str] = {}   # imageName -> nik
    proof_bindings: Dict[str, str] = {} # imageName -> nik
    recipients: List[PipelineRow]

class PdfParseResult(BaseModel):
    nomorKontrak: Optional[str] = None
    tanggalKontrak: Optional[str] = None
    namaPemesan: Optional[str] = None
    namaPenyedia: Optional[str] = None
    namaProduk: Optional[str] = None
    totalPembayaran: Optional[str] = None
    tables: List[Dict[str, Any]] = []
    total_pages: int = 0

class PdfParseRequest(BaseModel):
    path: str
