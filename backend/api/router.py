from fastapi import APIRouter, HTTPException, UploadFile, File, Body, Response
import os
import shutil
import io
import gc
from typing import Dict, Optional, List
from backend.services.pdf_service import extract_pdf_text, create_contract_bundle_zip
from backend.services.ktp_service import extract_ktp_data
from backend.services.automation_service import submit_to_government_site
from backend.services.data_engine import reconcile_files, ingest_excel_to_models, apply_magic_balance
from backend.services.location_service import location_service
from backend.services.pdf_intelligence import pdf_intel
from backend.models import (
    KtpResult, ReconciliationResult, AutomationRequest, 
    BundleRequest, PipelineRow, ExcelIngestResult, LocationData,
    PdfParseResult, PdfParseRequest
)

router = APIRouter()

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
        raise HTTPException(status_code=500, detail=f"Reconciliation Elite Error: {str(e)}")

@router.post("/pdf/parse", response_model=PdfParseResult)
async def pdf_parse(request: PdfParseRequest):
    try:
        analysis = pdf_intel.analyze_document(request.path)
        metadata = analysis["metadata"]
        return PdfParseResult(
            nomorKontrak=metadata.get("nomor_kontrak"),
            tanggalKontrak=metadata.get("tanggal_kontrak"),
            namaPemesan=metadata.get("nama_pemesan"),
            namaPenyedia=metadata.get("nama_penyedia"),
            namaProduk=metadata.get("nama_produk"),
            totalPembayaran=metadata.get("nilai_kontrak"),
            tables=analysis["tables"],
            total_pages=analysis["total_pages"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
async def ocr_ktp(file: UploadFile = File(...)):
    temp_path = f"temp_ocr_{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        data = extract_ktp_data(temp_path)
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

@router.post("/automation/submit")
async def submit_data(request: AutomationRequest):
    try:
        result = await submit_to_government_site(request.payload)
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
async def bundle_contract(request: BundleRequest):
    try:
        zip_bytes = create_contract_bundle_zip(request)
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={request.contract_id}_bundle.zip"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/session/reset")
async def reset_session():
    try:
        # Trigger manual garbage collection
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
