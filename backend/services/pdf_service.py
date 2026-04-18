# [DEPRECATED] PDF Service Proxy Shield
# -------------------------------------------------------------------
# This file is now a legacy portal for the Surgical Intelligence Stack.
# ALL logic has been unified into backend/services/pdf_intelligence.py
# for 90% token ROI and high-fidelity extraction.
# [LEARN-003]
# -------------------------------------------------------------------

import warnings
from backend.services.pdf_intelligence import pdf_intel
from backend.services.diagnostics import diagnostics

def _trace_legacy(func_name: str):
    """Logs the recall of a deprecated function for technical debt tracking."""
    msg = f"[DEPRECATED-RECALL] Legacy function '{func_name}' called in pdf_service.py"
    warnings.warn(msg, DeprecationWarning)
    diagnostics.log_breadcrumb("TECHNICAL-DEBT", msg)

# --- Proxy Methods (Mapping legacy calls to the new Surgical Source of Truth) ---

def extract_pdf_text(path):
    _trace_legacy("extract_pdf_text")
    analysis = pdf_intel.analyze_document(path)
    return analysis.get("metadata").full_text

def extract_pdf_metadata(path):
    _trace_legacy("extract_pdf_metadata")
    analysis = pdf_intel.analyze_document(path)
    return analysis.get("metadata").sections

def generate_bastb_pdf(metadata, recipient):
    _trace_legacy("generate_bastb_pdf")
    return pdf_intel.generate_bastb_pdf(metadata, recipient)

def generate_recipient_report(request, recipient, master_doc=None):
    _trace_legacy("generate_recipient_report")
    return pdf_intel.generate_recipient_report(request, recipient, master_doc)

def split_pdf_pages(input_path, pages, output_dir, prefix):
    _trace_legacy("split_pdf_pages")
    return pdf_intel.split_pdf_pages(input_path, pages, output_dir, prefix)

def create_contract_bundle_zip(request):
    _trace_legacy("create_contract_bundle_zip")
    return pdf_intel.create_contract_bundle_zip(request)

# Legacy aliases for direct imports if any
find_image = getattr(pdf_intel, 'find_img', None)
