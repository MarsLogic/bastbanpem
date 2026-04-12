import sys
import json
import os
import re

# Placeholder for PaddleOCR
# In production: 
# from paddleocr import PaddleOCR
# ocr = PaddleOCR(use_angle_cls=True, lang='latin')

def process_ktp(image_path):
    """
    Simulates KTP OCR processing with preprocessing and coordinate mapping.
    """
    # 1. Preprocessing: CLAHE and Blue-Channel isolation
    # print("DEBUG: Preprocessing image...")
    
    # 2. OCR Extraction
    # result = ocr.ocr(image_path, cls=True)
    
    # Mock data extraction based on filename or dummy values
    filename = os.path.basename(image_path)
    nik_match = re.search(r'\d{16}', filename)
    
    found_nik = nik_match.group(0) if nik_match else None
    
    # Coordinate Mapping logic (Placeholder)
    # NIK is usually at relative Y: 0.15 - 0.25
    # Name is usually at relative Y: 0.25 - 0.35
    
    return {
        "nik": found_nik,
        "confidence": 0.95 if found_nik else 0.0,
        "fields": {
            "nama": "SIMULATED NAME",
            "alamat": "SIMULATED ADDRESS"
        }
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)
        
    img_path = sys.argv[1]
    if not os.path.exists(img_path):
        print(json.dumps({"error": "File not found"}))
        sys.exit(1)
        
    result = process_ktp(img_path)
    print(json.dumps(result))
