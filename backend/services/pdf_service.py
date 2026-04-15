# [DOCS-001] PyMuPDF Slicing & Report Generation
import fitz # PyMuPDF
import os
import io
import zipfile
from typing import List, Optional, Dict
from backend.models import PipelineRow, BundleRequest
from backend.services.diagnostics import diagnostics
from backend.config import settings

def extract_pdf_text(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"PDF file not found: {path}")
        
    with fitz.open(path) as doc:
        text = ""
        for page in doc:
            text += page.get_text()
    return text

def extract_pdf_metadata(path):
    if not os.path.exists(path):
        return {}
    with fitz.open(path) as doc:
        metadata = doc.metadata
    return metadata

def generate_bastb_pdf(metadata: Dict, recipient: PipelineRow) -> bytes:
    """
    Expert Template: Berita Acara Serah Terima Barang (BASTB).
    Updated to support Proxy Recipients and Poktan branding.
    """
    with fitz.open() as doc:
        page = doc.new_page(width=595, height=842)
        # 1. Header with Title
        page.insert_text((150, 60), "BERITA ACARA SERAH TERIMA BARANG (BASTB)", fontsize=12, fontname="helv-bold")
        
        # 2. Poktan Branding (Contextual)
        poktan = recipient.group or "Umum"
        page.insert_text((50, 90), f"POKTAN / KELOMPOK: {poktan.upper()}", fontsize=9, fontname="helv-bold")
        
        # 3. Body Text
        y = 120
        page.insert_text((50, y), f"No : {metadata.get('nomor_kontrak', '.../BAST/...')}", fontsize=10)
        y += 20
        page.insert_text((50, y), f"Pada hari ini ................. tanggal ........ bulan ............ tahun dua ribu dua puluh lima", fontsize=10)
        
        # 4. Pihak Pertama & Kedua
        y += 30
        page.insert_text((50, y), "PIHAK PERTAMA (Pemesan)", fontname="helv-bold", fontsize=10)
        page.insert_text((200, y), f": {metadata.get('satker', 'DITJEN PSP - KEMENTAN')}", fontsize=10)
        
        y += 40
        page.insert_text((50, y), "PIHAK KEDUA (Penerima)", fontname="helv-bold", fontsize=10)
        
        # PROXY LOGIC: If proxy exists, show both names
        p_name = recipient.name
        if hasattr(recipient, 'proxy') and recipient.proxy:
            p_name = f"{recipient.name} (Diterima Oleh: {recipient.proxy.name} - {recipient.proxy.relation})"
            
        page.insert_text((200, y), f": {p_name}", fontsize=10)
        page.insert_text((200, y+15), f"NIK : {recipient.nik}", fontsize=10)
        
        # 5. Item Table Section
        y += 60
        page.draw_rect([50, y, 545, y+20], color=(0,0,0), width=1)
        page.insert_text((55, y+15), "No", fontsize=9)
        page.insert_text((100, y+15), "Nama Barang", fontsize=9)
        page.insert_text((400, y+15), "Kuantitas", fontsize=9)
        
        # Fill Row 1
        y += 20
        page.draw_rect([50, y, 545, y+25], color=(0,0,0), width=0.5)
        page.insert_text((55, y+15), "1", fontsize=9)
        page.insert_text((100, y+15), metadata.get('nama_produk', 'Bantuan Pemerintah'), fontsize=9)
        qty = recipient.financials.qty if hasattr(recipient, 'financials') else 0
        page.insert_text((400, y+15), f"{qty} Unit", fontsize=9)
        
        # 6. Signature Section
        y = 650
        page.insert_text((50, y), "PIHAK KEDUA", fontsize=10, fontname="helv-bold")
        page.insert_text((400, y), "PIHAK PERTAMA", fontsize=10, fontname="helv-bold")
        
        # --- PAGE 2: PROOF SHEET (PHOTOS) ---
        proof_page = doc.new_page(width=595, height=842)
        proof_page.insert_text((50, 50), "LAMPIRAN DOKUMENTASI (PROOF SHEET)", fontsize=12, fontname="helv-bold")
        
        # KTP Section
        proof_page.insert_text((50, 80), "IDENTITAS PENERIMA (KTP)", fontsize=10, fontname="helv-bold")
        # Layout Proof Photos
        return doc.tobytes()

def generate_recipient_report(
    request: BundleRequest,
    recipient: PipelineRow,
    master_doc: Optional[fitz.Document] = None
) -> bytes:
    """
    Elite PDF Generation: BASTB + Evidence Slicing + KTP/Proof Side-by-Side.
    Prioritizes edited/cropped images over raw ones.
    """
    with fitz.open() as report:
        # --- PAGE 1: BASTB FORM ---
        bastb_bytes = generate_bastb_pdf({
            "nomor_kontrak": request.contract_no,
            "tanggal_kontrak": request.contract_date,
            "nama_produk": request.contract_name,
            "satker": "DITJEN PSP"
        }, recipient)
        
        bastb_doc = fitz.open("pdf", bastb_bytes)
        report.insert_pdf(bastb_doc)
        bastb_doc.close()

        # --- PAGE 2: PROOF SHEET (PHOTOS) ---
        page = report.new_page(width=595, height=842)
        page.insert_text((50, 50), "DOKUMENTASI PENYALURAN", fontsize=14, fontname="helv-bold")
        
        y = 100
        # 1. Identity Box
        page.draw_rect([50, y, 280, y+180], color=(0,0,0), width=1)
        page.insert_text((60, y-10), "KTP / IDENTITAS", fontsize=9, fontname="helv-bold")
        
        # 2. Evidence Box
        page.draw_rect([310, y, 540, y+180], color=(0,0,0), width=1)
        page.insert_text((320, y-10), "FOTO PENYERAHAN BARANG", fontsize=9, fontname="helv-bold")

        # Resolve Images (Prioritize edited versions)
        def find_image(directory, bindings, nik):
            if not directory: return None
            # Look for edited version first
            for img_name, bound_nik in bindings.items():
                if bound_nik == nik and "_edited_" in img_name:
                    return os.path.join(directory, img_name)
            # Fallback to raw
            for img_name, bound_nik in bindings.items():
                if bound_nik == nik:
                    return os.path.join(directory, img_name)
            return None

        ktp_path = find_image(request.ktp_dir, request.ktp_bindings, recipient.nik)
        proof_path = find_image(request.proof_dir, request.proof_bindings, recipient.nik)

        if ktp_path and os.path.exists(ktp_path):
            page.insert_image([60, y+10, 270, y+170], filename=ktp_path, keep_proportion=True)
        else:
            page.insert_text((100, y+90), "[KTP TIDAK ADA]", color=(0.5, 0.5, 0.5), fontsize=8)

        if proof_path and os.path.exists(proof_path):
            page.insert_image([320, y+10, 530, y+170], filename=proof_path, keep_proportion=True)
        else:
            page.insert_text((360, y+90), "[FOTO TIDAK ADA]", color=(0.5, 0.5, 0.5), fontsize=8)

        # --- PAGE 3: CONTRACT EVIDENCE (SLICED FROM MASTER) ---
        if master_doc and recipient.page_source > 0:
            report.insert_pdf(master_doc, from_page=recipient.page_source-1, to_page=recipient.page_source-1)
            evidence_page = report[-1]
            evidence_page.draw_rect([0, 0, evidence_page.rect.width, 25], fill=(0, 0, 0), color=(0, 0, 0))
            evidence_page.insert_text((20, 17), f"LAMPIRAN KONTRAK: HALAMAN {recipient.page_source}", color=(1, 1, 1), fontsize=9)

        return report.tobytes()

def split_pdf_pages(input_path: str, pages: List[int], output_dir: str, prefix: str) -> List[str]:
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    created_files = []
    doc = fitz.open(input_path)
    try:
        for page_num in pages:
            new_doc = fitz.open()
            new_doc.insert_pdf(doc, from_page=page_num-1, to_page=page_num-1)
            filename = f"{prefix}_page_{page_num}.pdf"
            out_path = os.path.join(output_dir, filename)
            new_doc.save(out_path)
            new_doc.close()
            created_files.append(out_path)
        return created_files
    finally:
        doc.close()

import tempfile

def create_contract_bundle_zip(request: BundleRequest) -> str:
    """
    Elite Orchestrator: Bundles all recipients into a single ZIP file.
    Optimized for low memory footprint by writing directly to disk.
    Returns: Absolute path to the generated ZIP file.
    """
    diagnostics.log_breadcrumb("BUNDLER", f"Starting Low-Memory ZIP generation for {len(request.recipients)} recipients")
    
    # Create a persistent temporary file
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    temp_zip_path = temp_zip.name
    temp_zip.close()
    
    try:
        master_doc = None
        if request.master_pdf_path and os.path.exists(request.master_pdf_path):
            master_doc = fitz.open(request.master_pdf_path)

        with zipfile.ZipFile(temp_zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for recipient in request.recipients:
                # Generate individual PDF report
                pdf_bytes = generate_recipient_report(request, recipient, master_doc)
                
                # Filename sanitization
                safe_name = "".join([c if c.isalnum() else "_" for c in recipient.name])
                filename = f"{recipient.nik}_{safe_name}.pdf"
                
                # Write to ZIP on disk
                zip_file.writestr(filename, pdf_bytes)
        
        if master_doc: 
            master_doc.close()
                
        return temp_zip_path
    except Exception as e:
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)
        diagnostics.log_error("ZIP-BUNDLE-ERR", str(e))
        raise e
