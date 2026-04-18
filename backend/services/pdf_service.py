# [DEPRECATED] PDF Service Proxy Shield
# -------------------------------------------------------------------
# This file is now a legacy portal for the Surgical Intelligence Stack.
# ALL logic has been unified into backend/services/pdf_intelligence.py
# for 90% token ROI and high-fidelity extraction.
# [LEARN-003]
# -------------------------------------------------------------------

import warnings
from backend.services.pdf_intelligence import pdf_intel

# --- Proxy Methods (Mapping legacy calls to the new Surgical Source of Truth) ---

def extract_pdf_text(path):
    warnings.warn("pdf_service.extract_pdf_text is deprecated. Use pdf_intel.analyze_document(path)", DeprecationWarning)
    analysis = pdf_intel.analyze_document(path)
    return analysis.get("metadata").full_text

def extract_pdf_metadata(path):
    warnings.warn("pdf_service.extract_pdf_metadata is deprecated. Use pdf_intel.analyze_document(path)", DeprecationWarning)
    analysis = pdf_intel.analyze_document(path)
    return analysis.get("metadata").sections # Or other metadata fields

def generate_bastb_pdf(metadata, recipient):
    return pdf_intel.generate_bastb_pdf(metadata, recipient)

def generate_recipient_report(request, recipient, master_doc=None):
    return pdf_intel.generate_recipient_report(request, recipient, master_doc)

def split_pdf_pages(input_path, pages, output_dir, prefix):
    return pdf_intel.split_pdf_pages(input_path, pages, output_dir, prefix)

def create_contract_bundle_zip(request):
    return pdf_intel.create_contract_bundle_zip(request)

# Legacy aliases for direct imports if any
find_image = getattr(pdf_intel, 'find_img', None)
