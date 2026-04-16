from fastapi import APIRouter, HTTPException, UploadFile, File, Body, Response, BackgroundTasks
from fastapi.responses import FileResponse
import os
import shutil
import io
import gc
from typing import Dict, Optional, List, Any
from backend.services.pdf_service import extract_pdf_text, create_contract_bundle_zip
from backend.services.ktp_service import extract_ktp_data
from backend.services.automation_service import submit_to_government_site
from backend.services.data_engine import reconcile_files, ingest_excel_to_models, apply_magic_balance
from backend.services.location_service import location_service
from backend.services.pdf_intelligence import pdf_intel
from backend.models import (
    KtpResult, ReconciliationResult, AutomationRequest, 
    BundleRequest, PipelineRow, ExcelIngestResult, LocationData,
    PdfParseResult, PdfParseRequest, BatchSummary
)

from backend.services.cpcl_extractor import cpcl_extractor
from backend.services.watcher_service import watcher_service
from backend.services.portal_service import portal_service
from backend.services.batch_worker import batch_worker

router = APIRouter()

@router.post("/contracts/cpcl")
async def extract_cpcl(request: Dict[str, str]):
    try:
        path = request.get("path")
        data = cpcl_extractor.extract(path)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/watcher/start")
async def start_watcher(path: str = Body(...)):
    try:
        watcher_service.start(path)
        return {"status": "success", "message": f"Watching {path}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reconcile", response_model=ReconciliationResult)
async def reconcile(
    pdf_file: UploadFile = File(...),
    excel_file: UploadFile = File(...)
):
    try:
        temp_pdf = f"temp_{pdf_file.filename}"
        with open(temp_pdf, "wb") as f:
            shutil.copyfileobj(pdf_file.file, f)
        
        pdf_text = extract_pdf_text(temp_pdf)
        os.remove(temp_pdf)
        
        excel_content = await excel_file.read()
        return reconcile_files(pdf_text, excel_content)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reconciliation error: {str(e)}")

@router.post("/pdf/parse", response_model=PdfParseResult)
async def pdf_parse(file: UploadFile = File(...)):
    """Parse PDF file and extract metadata, tables, and page count."""
    temp_path = f"temp_pdf_{file.filename}"
    try:
        # Write uploaded file to temp location
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Analyze document
        analysis = pdf_intel.analyze_document(temp_path)

        # Extract metadata with proper field mapping
        metadata = analysis["metadata"]

        return PdfParseResult(
            metadata=metadata,
            delivery_blocks=analysis.get("delivery_blocks", []),
            tables=analysis["tables"],
            total_pages=analysis["total_pages"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parse error: {str(e)}")
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.post("/excel/ingest", response_model=ExcelIngestResult)
async def excel_ingest(file: UploadFile = File(...)):
    try:
        content = await file.read()
        return ingest_excel_to_models(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/excel/balance", response_model=List[PipelineRow])
async def excel_balance(rows: List[PipelineRow] = Body(...), target_total: float = Body(...)):
    try:
        return apply_magic_balance(rows, target_total)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ktp/ocr", response_model=KtpResult)
async def ocr_ktp(file: UploadFile = File(...), model_version: Optional[str] = Body(None)):
    temp_path = f"temp_ocr_{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        data = extract_ktp_data(temp_path, model_version=model_version)
        os.remove(temp_path)
        return KtpResult(**data)
    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/locations/resolve", response_model=LocationData)
async def resolve_location(loc: LocationData):
    try:
        repaired = location_service.resolve_location(
            provinsi=loc.provinsi,
            kabupaten=loc.kabupaten,
            kecamatan=loc.kecamatan,
            desa=loc.desa
        )
        return LocationData(
            provinsi=loc.provinsi,
            kabupaten=loc.kabupaten,
            kecamatan=loc.kecamatan,
            desa=loc.desa,
            suggested_provinsi=repaired["provinsi"] if repaired["provinsi"] != loc.provinsi else None,
            suggested_kabupaten=repaired["kabupaten"] if repaired["kabupaten"] != loc.kabupaten else None,
            suggested_kecamatan=repaired["kecamatan"] if repaired["kecamatan"] != loc.kecamatan else None,
            suggested_desa=repaired["desa"] if repaired["desa"] != loc.desa else None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pdf/split")
async def split_pdf(request: Dict[str, Any]):
    try:
        path = request.get("path")
        pages = request.get("pages", [])
        output_dir = request.get("output_dir", "output/splits")
        prefix = request.get("prefix", "split")
        
        # files = split_pdf_pages(path, pages, output_dir, prefix)
        return {"status": "success", "message": "Split logic placeholder"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/automation/submit")
async def submit_data(request: AutomationRequest):
    try:
        result = await submit_to_government_site(request.payload)
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Portal Integration Endpoints [EXPERT-002] ---

@router.get("/portal/contracts")
async def get_portal_contracts():
    try:
        contracts = portal_service.fetch_contracts()
        return {"status": "success", "data": contracts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/portal/contracts/{idkontrak}")
async def get_portal_contract_detail(idkontrak: str):
    try:
        detail = portal_service.fetch_contract_details(idkontrak)
        return detail
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/portal/contracts/{idkontrak}/sync-recipient")
async def sync_portal_recipient(idkontrak: str, data: Dict = Body(...)):
    try:
        result = portal_service.sync_recipient(idkontrak, data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/portal/contracts/{idkontrak}/recipients/{idpenerima}/upload")
async def upload_portal_proof(
    idkontrak: str, 
    idpenerima: str, 
    file: UploadFile = File(...), 
    type: str = Body(...)
):
    try:
        temp_path = f"temp_upload_{file.filename}"
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        field_map = {
            'bastb': 'pn_bastb',
            'sj': 'pn_surat_jalan',
            'photo': 'pn_foto_1'
        }
        field = field_map.get(type, 'pn_bastb')

        result = portal_service.upload_proof(
            idkontrak=idkontrak,
            idpenerima=idpenerima,
            file_path=temp_path,
            field_name=field
        )
        
        os.remove(temp_path)
        return result
    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/portal/recipients/register")
async def register_portal_recipient(data: Dict = Body(...)):
    try:
        result = portal_service.register_recipient(data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Batch Processing Endpoints [EXPERT-003] ---

@router.post("/portal/batch/start")
async def start_portal_batch(
    background_tasks: BackgroundTasks,
    idkontrak: str = Body(...), 
    recipients: List[Dict] = Body(...)
):
    try:
        # Generate batch ID first to return to client
        import uuid
        batch_id = str(uuid.uuid4())
        
        # Start worker in background
        background_tasks.add_task(batch_worker.run_batch, idkontrak, recipients)
        
        return {"status": "success", "batch_id": batch_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/portal/batch/status/{batch_id}", response_model=BatchSummary)
async def get_portal_batch_status(batch_id: str):
    summary = batch_worker.get_status(batch_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Batch not found")
    return summary

@router.post("/portal/batch/cancel/{batch_id}")
async def cancel_portal_batch(batch_id: str):
    batch_worker.cancel_batch(batch_id)
    return {"status": "success", "message": "Cancellation signal sent"}

# --- License Intelligence Endpoints ---

from backend.services.license_service import LicenseService
license_svc = LicenseService()

@router.get("/license/status")
async def get_license_status():
    return license_svc.validate_license()

@router.get("/license/hwid")
async def get_license_hwid():
    return {"hwid": license_svc.get_machine_id()}

# --------------------------------------------------

from backend.services.vault_service import vault_service

@router.post("/contracts/save")
async def save_contract_data(id: str, name: str, target_value: float, rows: List[PipelineRow]):
    try:
        vault_service.save_contract(id, name, target_value)
        vault_service.save_recipients(id, rows)
        return {"status": "success", "message": f"Saved {len(rows)} recipients."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/contracts/bundle")
async def bundle_contract(request: BundleRequest, background_tasks: BackgroundTasks):
    try:
        zip_path = create_contract_bundle_zip(request)
        
        background_tasks.add_task(os.remove, zip_path)
        
        return FileResponse(
            path=zip_path,
            filename=f"{request.contract_id}_bundle.zip",
            media_type="application/zip"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/session/reset")
async def reset_session():
    try:
        gc.collect()
        return {"status": "success", "message": "Backend memory cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search")
async def search_vault(q: str, contract_id: Optional[str] = None):
    try:
        results = vault_service.master_search(q, contract_id)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
