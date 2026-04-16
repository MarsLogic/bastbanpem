from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class KtpResult(BaseModel):
    nik: Optional[str] = None
    nama: Optional[str] = None
    provinsi: Optional[str] = None
    kabupaten: Optional[str] = None
    kecamatan: Optional[str] = None
    desa: Optional[str] = None
    alamat: Optional[str] = None
    rtrw: Optional[str] = None
    rt: Optional[str] = None
    rw: Optional[str] = None
    tgl_lahir: Optional[str] = None
    jenis_kelamin: Optional[str] = None
    agama: Optional[str] = None
    status_perkawinan: Optional[str] = None
    pekerjaan: Optional[str] = None
    kewarganegaraan: Optional[str] = None
    berlaku_hingga: Optional[str] = None
    derived_dob: Optional[str] = None
    confidence: float = 0.0
    error: Optional[str] = None
    metadata: Dict[str, Any] = {}

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

class EvidenceData(BaseModel):
    # Mandatory (*)
    delivery_order_path: Optional[str] = None  # File
    invoice_ongkir_path: Optional[str] = None # File
    foto_bukti_1_path: Optional[str] = None   # File
    
    # Optional / Conditional
    cert_lab_path: Optional[str] = None       # Sertifikasi Lab
    ongkir_value: float = 0.0
    uji_lab_path: Optional[str] = None        # Uji Lab File
    no_sertifikat_lab: Optional[str] = None
    tgl_sertifikat_lab: Optional[str] = None
    lembaga_penguji: Optional[str] = None
    
    # Additional Photos
    foto_bukti_2_path: Optional[str] = None
    foto_bukti_3_path: Optional[str] = None
    foto_bukti_4_path: Optional[str] = None
    foto_bukti_5_path: Optional[str] = None

class ContractMetadata(BaseModel):
    # === Contract Identity ===
    nomor_kontrak: Optional[str] = None       # No. Surat Pesanan
    tanggal_kontrak: Optional[str] = None     # Tanggal Surat Pesanan

    # === Pemesan (Purchaser) ===
    nama_pemesan: Optional[str] = None        # Org name (Direktorat/Dinas etc)
    nama_ppk: Optional[str] = None            # Nama Penanggung Jawab PPK
    npwp_pemesan: Optional[str] = None        # NPWP Pemesan

    # === Penyedia (Vendor) ===
    nama_penyedia: Optional[str] = None       # Vendor company name
    npwp_penyedia: Optional[str] = None       # NPWP Penyedia

    # === Product ===
    nama_produk: Optional[str] = None         # Product name (e.g. INSEKTISIDA VISTA 400 SL)
    harga_satuan: Optional[str] = None        # Unit price per liter/unit
    total_kuantitas: Optional[str] = None     # Total volume (e.g. 28.943,00 liter)

    # === Financials ===
    nilai_kontrak: Optional[str] = None       # Estimasi Total Pembayaran
    nilai_penyaluran: float = 0.0
    nilai_bast: float = 0.0
    nilai_spm: float = 0.0
    nilai_konfirmasi: float = 0.0

    # === Delivery Config ===
    jumlah_tahap: Optional[str] = None        # Number of delivery stages

    # === Flags ===
    is_ongkir_terpisah: bool = False
    is_swakelola: bool = False
    is_menggunakan_termin: bool = False

    # === Legacy / Other Contract Types ===
    eselon1: Optional[str] = None
    satker: Optional[str] = None
    nomor_dipa: Optional[str] = None
    kegiatan_output_akun: Optional[str] = None
    judul_kegiatan: Optional[str] = None
    titik_bagi: Optional[str] = None
    tipe_penerima: Optional[str] = None
    jenis_kontrak: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_npwp: Optional[str] = None
    dibuat_oleh: Optional[str] = None
    
    # Financials
    nilai_penyaluran: float = 0.0
    nilai_bast: float = 0.0
    nilai_spm: float = 0.0
    nilai_konfirmasi: float = 0.0
    
    # Flags
    is_ongkir_terpisah: bool = False
    is_swakelola: bool = False
    is_menggunakan_termin: bool = False
    dibuat_oleh: Optional[str] = None

class PipelineRow(BaseModel):
    id: str
    nik: str
    name: str = ""
    location: LocationData = Field(default_factory=LocationData)
    financials: FinancialData = Field(default_factory=FinancialData)
    evidence: EvidenceData = Field(default_factory=EvidenceData)
    jadwal_tanam: str = ""
    group: str = ""
    is_synced: bool = False
    is_excluded: bool = False
    page_source: int = 0
    # Portal Alignment IDs
    idkontrak: Optional[str] = None
    idtermin: Optional[str] = None
    idbast: Optional[str] = None
    pn_nik: Optional[str] = None
    column_data: Dict[str, Any] = {} # All original columns
    original_row: Dict[str, Any] = {} # Copy for reset
    
class PortalSession(BaseModel):
    contract_id: str
    termin_id: Optional[str] = None
    bast_id: Optional[str] = None
    metadata: ContractMetadata = Field(default_factory=ContractMetadata)
    last_tab: str = "DATA KONTRAK"
    scraped_at: str
    
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
    metadata: ContractMetadata = Field(default_factory=ContractMetadata)
    delivery_blocks: List[Dict[str, Any]] = []   # Parsed pengiriman blocks (recipients)
    tables: List[Dict[str, Any]] = []
    total_pages: int = 0

class PdfParseRequest(BaseModel):
    path: str

class BatchTaskStatus(BaseModel):
    nik: str
    status: str
    error: Optional[str] = None
    timestamp: str

class BatchSummary(BaseModel):
    batch_id: str
    idkontrak: str
    total: int
    completed: int
    failed: int
    status: str
    tasks: List[BatchTaskStatus] = []
